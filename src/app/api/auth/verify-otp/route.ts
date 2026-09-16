import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/auth'

// POST /api/auth/verify-otp { phone, otp }
export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json()
    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone and OTP required' }, { status: 400 })
    }

    const record = await db.otpStore.findUnique({ where: { phone } })
    if (!record || record.code !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { phone } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (user.blocked) {
      return NextResponse.json({ error: 'Your account has been blocked. Contact support.' }, { status: 403 })
    }
    if (user.deleted) {
      return NextResponse.json({ error: 'This account has been deleted. Contact support.' }, { status: 403 })
    }

    await db.otpStore.delete({ where: { phone } }).catch(() => {})

    const token = generateToken()
    await db.user.update({
      where: { id: user.id },
      data: { otp: token, otpExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })

    return NextResponse.json({ ok: true, token, userId: user.id, phone: user.phone })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
