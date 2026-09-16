import { db } from '@/lib/db'

export const SETTING_SMS_OTP_ENABLED = 'sms_otp_enabled'
export const SETTING_REFERRAL_BONUS = 'referral_bonus'
export const SETTING_DOWNPAYMENT_PCT = 'downpayment_pct'
export const SETTING_TAWK_ENABLED = 'tawk_enabled'
export const SETTING_TAWK_WIDGET = 'tawk_widget_id'

export const SETTING_SMS_MATRIXSENDER_ENDPOINT = 'sms_matrixsender_endpoint'
export const SETTING_SMS_MATRIXSENDER_SECRET = 'sms_matrixsender_secret'
export const SETTING_SMS_MATRIXSENDER_MODE = 'sms_matrixsender_mode'
export const SETTING_SMS_MATRIXSENDER_GATEWAY = 'sms_matrixsender_gateway'
export const SETTING_SMS_MATRIXSENDER_DEVICE = 'sms_matrixsender_device'
export const SETTING_SMS_MATRIXSENDER_SIM = 'sms_matrixsender_sim'
export const SETTING_SMS_MATRIXSENDER_ACCOUNT = 'sms_matrixsender_wa_account'
export const SETTING_SMS_OTP_CHANNEL = 'sms_otp_channel'

// Admin panel access route (e.g. "/admin" -> "/newadmin"). Stored without the
// leading slash; overrides the ADMIN_PATH env var when set via the Settings tab.
export const SETTING_ADMIN_PATH = 'admin_path'

// Effective admin panel path segment (no leading/trailing slash, default "admin").
// Resolution: DB Setting (admin-editable) -> ADMIN_PATH env var -> "admin".
export async function getAdminPath(): Promise<string> {
  const v = await getSetting(SETTING_ADMIN_PATH)
  const raw = (v && v.trim()) || process.env.ADMIN_PATH?.trim() || '/admin'
  const normalized = raw.replace(/^\/+|\/+$/g, '')
  return normalized || 'admin'
}

// Loan configuration (production parity)
export const SETTING_MARKUP_PCT = 'markup_pct' // markup % applied to loan amount
export const SETTING_LOYALTY_REDUCE_PCT = 'loyalty_reduce_pct' // reduce markup by this % per repaid loan
export const SETTING_LOYALTY_MIN_MARKUP_PCT = 'loyalty_min_markup_pct' // loyalty floor for markup %
export const SETTING_LOAN_PACKAGES = 'loan_packages' // comma-separated PKR amounts

// Install App (Android APK) — admin uploads the APK, users download it from the login page.
export const SETTING_APP_FILE = 'app_file_url'
export const SETTING_APP_FILE_SIZE = 'app_file_size'
export const SETTING_APP_FILE_UPLOADED = 'app_file_uploaded'
export const APP_FILE_NAME = 'eqarza-app.apk'
export const APP_FILE_MAX_SIZE = 200 * 1024 * 1024

// In-memory read cache for settings so hot paths (OTP, loan flows, app-info)
// don't hit SQLite on every request. Single server process, so in-memory is
// safe. Writes invalidate/refresh the cache immediately.
const cache = new Map<string, { value: string | null; expires: number }>()
const CACHE_TTL_MS = Number(process.env.SETTINGS_CACHE_TTL_MS || 10_000)

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const s = await db.setting.findUnique({ where: { key } })
  const value = s?.value ?? null
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
  return value
}

export function invalidateSetting(key: string): void {
  cache.delete(key)
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}

// Real SMS/WhatsApp OTP delivery is allowed only when:
//  - demo mode is OFF (DEPLOY environment or .env DEMO_MODE=false), AND
//  - admin has not disabled OTP delivery (`sms_otp_enabled` setting, default enabled).
export async function isSmsOtpEnabled(): Promise<boolean> {
  if (process.env.DEMO_MODE === 'true') return false
  const v = await getSetting(SETTING_SMS_OTP_ENABLED)
  return v === null ? true : v === 'true'
}

// Referral reward amount in PKR (default 200).
export async function getReferralBonus(): Promise<number> {
  const v = await getSetting(SETTING_REFERRAL_BONUS)
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 200
}

// Security downpayment percentage (default 10).
export async function getDownpaymentPct(): Promise<number> {
  const v = await getSetting(SETTING_DOWNPAYMENT_PCT)
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 10
}

// Tawk.to live chat:
// enabled (default true) + widget id/property id gates whether the client loads it.
export async function isTawkEnabled(): Promise<boolean> {
  const v = await getSetting(SETTING_TAWK_ENABLED)
  return v === null ? true : v === 'true'
}

export async function getTawkWidgetId(): Promise<string | null> {
  return getSetting(SETTING_TAWK_WIDGET)
}

// Markup percentage applied to every loan (default 0 = interest-free).
export async function getMarkupPct(): Promise<number> {
  const v = await getSetting(SETTING_MARKUP_PCT)
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Per-repaid-loan loyalty markup reduction in % (default 0).
export async function getLoyaltyReducePct(): Promise<number> {
  const v = await getSetting(SETTING_LOYALTY_REDUCE_PCT)
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Minimum markup % floor when loyalty reductions apply (default 0).
export async function getLoyaltyMinMarkupPct(): Promise<number> {
  const v = await getSetting(SETTING_LOYALTY_MIN_MARKUP_PCT)
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Loan packages offered to users (default: income tiers).
export async function getLoanPackages(): Promise<number[]> {
  const v = await getSetting(SETTING_LOAN_PACKAGES)
  if (!v || !v.trim()) return []
  return v
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

export interface LoanConfig {
  markupPct: number
  loyaltyReducePct: number
  loyaltyMinMarkupPct: number
  packages: number[]
  downpaymentPct: number
}

export async function getLoanConfig(): Promise<LoanConfig> {
  const [markupPct, loyaltyReducePct, loyaltyMinMarkupPct, packages, downpaymentPct] = await Promise.all([
    getMarkupPct(),
    getLoyaltyReducePct(),
    getLoyaltyMinMarkupPct(),
    getLoanPackages(),
    getDownpaymentPct(),
  ])
  return { markupPct, loyaltyReducePct, loyaltyMinMarkupPct, packages, downpaymentPct }
}

// Effective markup for a user given their number of previously repaid loans.
export function effectiveMarkupPct(baseMarkupPct: number, repaidLoans: number, loyaltyReducePct: number, minMarkupPct: number): number {
  if (baseMarkupPct <= 0) return 0
  if (repaidLoans <= 0) return baseMarkupPct
  return Math.max(minMarkupPct, baseMarkupPct - loyaltyReducePct * repaidLoans)
}

// Total repayable with markup (rounded to nearest rupee).
export function calcTotalRepayable(amount: number, markupPct: number): number {
  return Math.round(amount * (1 + markupPct / 100))
}

export interface SmsApiConfig {
  channel: 'sms' | 'whatsapp' | 'both'
  matrixsender: {
    endpoint: string
    secret: string
    mode: 'credits' | 'devices'
    gateway: string
    device: string
    sim: string
    account: string
  }
}

// Effective SMS/WhatsApp gateway configuration.
// Resolution order per field: DB Setting (admin-editable) -> env var -> default.
export async function getSmsConfig(): Promise<SmsApiConfig> {
  const [dbEndpoint, dbSecret, dbMode, dbGateway, dbDevice, dbSim, dbAccount, dbChannel] =
    await Promise.all([
      getSetting(SETTING_SMS_MATRIXSENDER_ENDPOINT),
      getSetting(SETTING_SMS_MATRIXSENDER_SECRET),
      getSetting(SETTING_SMS_MATRIXSENDER_MODE),
      getSetting(SETTING_SMS_MATRIXSENDER_GATEWAY),
      getSetting(SETTING_SMS_MATRIXSENDER_DEVICE),
      getSetting(SETTING_SMS_MATRIXSENDER_SIM),
      getSetting(SETTING_SMS_MATRIXSENDER_ACCOUNT),
      getSetting(SETTING_SMS_OTP_CHANNEL),
    ])

  const or = (db: string | null, env: string | undefined) => (db && db.trim() ? db.trim() : env?.trim() || '')

  const mode = (or(dbMode, process.env.MATRIXSENDER_MODE) || 'credits') as 'credits' | 'devices'
  const channel = (or(dbChannel, process.env.MATRIXSENDER_CHANNEL) || 'sms') as 'sms' | 'whatsapp' | 'both'

  return {
    channel,
    matrixsender: {
      endpoint: or(
        dbEndpoint,
        process.env.MATRIXSENDER_ENDPOINT
      ) || 'https://matrixsender.com/api/send/sms',
      secret: or(dbSecret, process.env.MATRIXSENDER_SECRET),
      mode,
      gateway: or(dbGateway, process.env.MATRIXSENDER_GATEWAY),
      device: or(dbDevice, process.env.MATRIXSENDER_DEVICE),
      sim: or(dbSim, process.env.MATRIXSENDER_SIM) || '1',
      account: or(dbAccount, process.env.MATRIXSENDER_ACCOUNT),
    },
  }
}