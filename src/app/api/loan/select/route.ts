import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'
import { getEligibleLoanAmounts, calcWeeklyInstallment, calcDownpayment } from '@/lib/auth'
import { getLoanConfig, effectiveMarkupPct, calcTotalRepayable } from '@/lib/settings'

// POST /api/loan/select { amount }
export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!user.kyc) {
    return NextResponse.json({ error: 'Please complete KYC first' }, { status: 400 })
  }
  if (user.kyc.kycStatus !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Your KYC is pending admin verification. You can apply once it is approved.' },
      { status: 400 }
    )
  }

  const { amount, referredCode } = await req.json()
  const amt = Number(amount)
  const cfg = await getLoanConfig()
  const eligible = cfg.packages.length ? cfg.packages : getEligibleLoanAmounts(user.kyc.monthlyIncome)
  if (!eligible.includes(amt)) {
    return NextResponse.json({ error: 'You are not eligible for this loan amount' }, { status: 400 })
  }

  const existingActive = user.loans.find(l =>
    ['DRAFT', 'DOWNPAYMENT_PENDING', 'DOWNPAYMENT_APPROVED', 'FIRST_INSTALLMENT_PENDING', 'ACTIVE'].includes(l.status)
  )
  if (existingActive) {
    return NextResponse.json(
      { error: 'You already have an active or pending loan. Please complete it first.', loan: existingActive },
      { status: 400 }
    )
  }

  // Optional referral code: only accept codes that belong to another active user,
  // and a user cannot refer themselves.
  let linkedReferral: { code: string } | undefined
  if (referredCode) {
    const normalized = String(referredCode).trim().toUpperCase()
    if (normalized === user.referralCode) {
      return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }
    const referrer = await db.user.findFirst({ where: { referralCode: normalized, deleted: false, blocked: false } })
    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }
    linkedReferral = { code: normalized }
    await db.user.update({ where: { id: user.id }, data: { referredBy: normalized } })
  }

  // Markup with loyalty reduction (per completed loan) and floor.
  const repaidLoans = await db.loan.count({ where: { userId: user.id, status: 'COMPLETED' } })
  const markupPct = effectiveMarkupPct(cfg.markupPct, repaidLoans, cfg.loyaltyReducePct, cfg.loyaltyMinMarkupPct)
  const totalRepayable = calcTotalRepayable(amt, markupPct)
  const weeklyInstallment = calcWeeklyInstallment(totalRepayable)
  const downpayment = calcDownpayment(amt, cfg.downpaymentPct)

  const loan = await db.loan.create({
    data: {
      userId: user.id,
      amount: amt,
      termDays: 30,
      weeklyInstallment,
      totalInstallments: 4,
      interestRate: markupPct,
      downpaymentAmount: downpayment,
      downpaymentStatus: 'PENDING',
      status: 'DOWNPAYMENT_PENDING',
      referredCode: linkedReferral?.code || null,
    },
    include: { installments: true },
  })

  return NextResponse.json({ ok: true, loan })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const loans = await db.loan.findMany({
    where: { userId: user.id },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  // The newest loan still in progress (COMPLETED loans are terminal). REJECTED loans
  // are kept here so the user can re-upload their downpayment proof / view the rejection.
  const loan = loans.find((l) => l.status !== 'COMPLETED') || null

  // Full history (all the user's loans, including COMPLETED ones), newest first.
  return NextResponse.json({ loan, loans })
}
