import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp } from '@/lib/auth'
import { sendOtpSms, type SmsSendResult } from '@/lib/sms'
import { isSmsOtpEnabled } from '@/lib/settings'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/activity'

const OTP_COOLDOWN_SECONDS = Math.max(1, Number(process.env.OTP_COOLDOWN_SECONDS || 10))
const OTP_COOLDOWN_MS = OTP_COOLDOWN_SECONDS * 1000 // resend cooldown between new codes
const OTP_VALIDITY_MS = 5 * 60 * 1000 // 5 minutes

// Abuse protection: cap OTP minting per phone and per IP.
const OTP_PHONE_LIMIT = Number(process.env.OTP_PHONE_LIMIT || 8) // per hour
const OTP_IP_LIMIT = Number(process.env.OTP_IP_LIMIT || 30) // per hour
const OTP_WINDOW_MS = 60 * 60 * 1000

// POST /api/auth/send-otp  { phone }
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const body = await req.json().catch(() => null)
    const phone = body?.phone
    if (!phone || !/^03\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number. Use 03XXXXXXXXX format.' }, { status: 400 })
    }

    if (!rateLimit(`otp:ip:${ip}`, OTP_IP_LIMIT, OTP_WINDOW_MS)) {
      return NextResponse.json({ error: 'Too many OTP requests. Please try again later.' }, { status: 429 })
    }
    if (!rateLimit(`otp:phone:${phone}`, OTP_PHONE_LIMIT, OTP_WINDOW_MS)) {
      return NextResponse.json({ error: 'Too many OTP requests for this number. Please try again later.' }, { status: 429 })
    }

    // Cooldown/resend: within the cooldown window we RESEND the existing code
    // (same OTP) instead of generating a new one, so "Resend" never gets a dead
    // 429 "please wait". A fresh code is only minted after the cooldown passes.
    const existing = await db.otpStore.findUnique({ where: { phone } })
    const withinCooldown = !!existing && existing.createdAt.getTime() > Date.now() - OTP_COOLDOWN_MS
    const otp = withinCooldown && existing ? existing.code : generateOtp()
    const expiresAt =
      existing && existing.expiresAt.getTime() > Date.now()
        ? existing.expiresAt
        : new Date(Date.now() + OTP_VALIDITY_MS)

    await db.otpStore.upsert({
      where: { phone },
      create: { phone, code: otp, expiresAt },
      update: { code: otp, expiresAt, createdAt: new Date() },
    })

    await db.user.upsert({
      where: { phone },
      create: { phone },
      update: {},
    })

    const account = await db.user.findUnique({ where: { phone } })
    if (account?.blocked) {
      return NextResponse.json({ error: 'Your account has been blocked. Contact support.' }, { status: 403 })
    }
    if (account?.deleted) {
      return NextResponse.json({ error: 'This account has been deleted. Contact support.' }, { status: 403 })
    }

    // Send OTP via matrixsender.com SMS gateway
    // Skipped when admin disabled SMS OTP or in demo mode (DEMO_MODE=true).
    const smsEnabled = await isSmsOtpEnabled()
    let sms: SmsSendResult | null = null

    if (smsEnabled) {
      sms = await sendOtpSms(phone, otp)
      console.log(`[send-otp] phone=${phone} provider=${sms.provider} ok=${sms.ok}`, sms.response || sms.error || '')
    } else {
      console.log(`[send-otp] phone=${phone} provider=none skipped (sms_otp_enabled=false)`)
      // No SMS is going out — surface the OTP to the user via their notifications.
      if (account) {
        await db.notification.create({
          data: {
            userId: account.id,
            title: 'Your OTP Code',
            body: `Your E-Qarza verification code is ${otp}. It expires in 5 minutes. Don't share it with anyone.`,
            type: 'OTP',
          },
        })
      }
    }

    if (sms?.ok) {
      return NextResponse.json({
        ok: true,
        sent: true,
        resent: withinCooldown,
        cooldown: OTP_COOLDOWN_SECONDS,
        message: withinCooldown ? `OTP resent via SMS to ${phone}.` : `OTP sent via SMS to ${phone}.`,
      })
    }

    // SMS was attempted but both gateways rejected/failed the request — report the
    // real reason (never claim the OTP was delivered over SMS).
    if (sms && !sms.ok) {
      const reason = sms.error || `Provider rejected the request${sms.response ? `: ${sms.response}` : ''}`
      console.error(`[send-otp] phone=${phone} SMS delivery failed: ${reason}`)

      // Dev/demo: still unblock login by returning the OTP inline, with a clear warning.
      if (process.env.NODE_ENV !== 'production' || !smsEnabled) {
        return NextResponse.json({
          ok: true,
          sent: false,
          demo: true,
          resent: withinCooldown,
          cooldown: OTP_COOLDOWN_SECONDS,
          otp,
          message: `SMS delivery failed (${reason}). Using demo code shown below.`,
        })
      }

      return NextResponse.json(
        { ok: false, sent: false, error: `Failed to send OTP. ${reason}` },
        { status: 502 }
      )
    }

    // Demo / SMS-disabled / SMS-unavailable fallback: return the OTP inline
    // (never when real SMS is enabled in production).
    const showInlineOtp = process.env.NODE_ENV !== 'production' || !smsEnabled
    if (showInlineOtp) {
      return NextResponse.json({
        ok: true,
        sent: false,
        demo: true,
        resent: withinCooldown,
        cooldown: OTP_COOLDOWN_SECONDS,
        otp,
        message: `OTP sent to ${phone}. Check your notifications for the code.`,
      })
    }

    return NextResponse.json({
      ok: true,
      sent: false,
      resent: withinCooldown,
      cooldown: OTP_COOLDOWN_SECONDS,
      message: `OTP sent to ${phone}.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}