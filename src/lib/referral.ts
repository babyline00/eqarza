import { db } from '@/lib/db'

// Generate a short, human-friendly referral code from a phone number.
// Format: EQZ + last 4 digits of phone + 2 random chars (uppercase A-Z0-9).
export function generateReferralCode(phone: string): string {
  const tail = phone.replace(/[^0-9]/g, '').slice(-4)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 2; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `EQZ${tail}${suffix}`
}

// Resolve a referral code to the owning user (active accounts only).
export async function findUserByReferralCode(code?: string | null) {
  if (!code || typeof code !== 'string') return null
  const normalized = code.trim().toUpperCase()
  return db.user.findFirst({
    where: {
      referralCode: normalized,
      deleted: false,
      blocked: false,
    },
  })
}

// Reward given to a referrer when their referral commits to a loan (downpayment approved).
export const REFERRAL_REWARD_AMOUNT = 200