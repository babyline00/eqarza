import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'
import { generateReferralCode } from '@/lib/referral'
import { getReferralBonus } from '@/lib/settings'

// GET /api/user/me  -> current user with kyc + loans
export async function GET(req: NextRequest) {
  let user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure every user has a referral code (idempotent, lazily assigned so legacy
  // accounts created before referral support also get one).
  if (!user.referralCode) {
    const code = generateReferralCode(user.phone)
    await db.user.update({
      where: { id: user.id },
      data: { referralCode: code },
    })
    // Reload so the response includes the fresh referralCode.
    user = await getUserFromReq(req, true)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    phone: user.phone,
    name: user.name,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    rewardBalance: user.rewardBalance,
    referralBonus: await getReferralBonus(),
    kyc: user.kyc,
    loans: user.loans,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const updated = await db.user.update({
    where: { id: user.id },
    data: { name: body.name ?? user.name },
  })
  return NextResponse.json({ ok: true, user: { id: updated.id, phone: updated.phone, name: updated.name } })
}
