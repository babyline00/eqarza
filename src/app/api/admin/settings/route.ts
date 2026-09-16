import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'
import {
  isSmsOtpEnabled,
  getSetting,
  getReferralBonus,
  getDownpaymentPct,
  isTawkEnabled,
  getTawkWidgetId,
  getSmsConfig,
  getLoanConfig,
  invalidateSetting,
  SETTING_SMS_OTP_ENABLED,
  SETTING_REFERRAL_BONUS,
  SETTING_DOWNPAYMENT_PCT,
  SETTING_TAWK_ENABLED,
  SETTING_TAWK_WIDGET,
} from '@/lib/settings'

// GET /api/admin/settings  -> settings list + effective flag states
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const settings = await db.setting.findMany()
  return NextResponse.json({
    settings,
    smsOtpEnabled: await isSmsOtpEnabled(),
    smsOtpConfigured: await getSetting(SETTING_SMS_OTP_ENABLED),
    demoMode: process.env.DEMO_MODE === 'true',
    referralBonus: Number(await getReferralBonus()),
    downpaymentPct: Number(await getDownpaymentPct()),
    tawkEnabled: await isTawkEnabled(),
    tawkWidgetId: await getTawkWidgetId(),
    smsApi: await getSmsConfig(),
    loanConfig: await getLoanConfig(),
    settingsMap: {
      [SETTING_REFERRAL_BONUS]: await getSetting(SETTING_REFERRAL_BONUS),
      [SETTING_DOWNPAYMENT_PCT]: await getSetting(SETTING_DOWNPAYMENT_PCT),
      [SETTING_TAWK_ENABLED]: await getSetting(SETTING_TAWK_ENABLED),
      [SETTING_TAWK_WIDGET]: await getSetting(SETTING_TAWK_WIDGET),
    },
  })
}

// POST /api/admin/settings { key, value }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const { key, value } = await req.json()
  if (!key || typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'key and value (string) are required' }, { status: 400 })
  }

  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
  invalidateSetting(key)

  await logActivity({ type: 'SETTINGS_UPDATED', actor: admin.username, action: 'Updated setting', details: `${key}`, ip: getClientIp(req) })

  return NextResponse.json({ ok: true, setting: { key, value } })
}