import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'
import { getEligibleLoanAmounts, calcWeeklyInstallment, calcDownpayment } from '@/lib/auth'
import { getLoanConfig, effectiveMarkupPct, calcTotalRepayable } from '@/lib/settings'

// GET /api/loan/eligibility
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!user.kyc) {
    return NextResponse.json({ error: 'Please complete KYC first' }, { status: 400 })
  }

  const cfg = await getLoanConfig()

  // Admin-defined loan packages take priority; otherwise fall back to income tiers.
  const amounts = cfg.packages.length ? cfg.packages : getEligibleLoanAmounts(user.kyc.monthlyIncome)

  // Loyalty: each previously repaid loan reduces the markup (floor applies).
  const repaidLoans = await db.loan.count({ where: { userId: user.id, status: 'COMPLETED' } })
  const markupPct = effectiveMarkupPct(cfg.markupPct, repaidLoans, cfg.loyaltyReducePct, cfg.loyaltyMinMarkupPct)

  const options = amounts.map((amount) => {
    const totalRepayable = calcTotalRepayable(amount, markupPct)
    return {
      amount,
      weeklyInstallment: calcWeeklyInstallment(totalRepayable),
      weeks: 4,
      totalRepayable,
      markupPct,
      downpayment: calcDownpayment(amount, cfg.downpaymentPct),
      downpaymentPct: cfg.downpaymentPct,
    }
  })

  return NextResponse.json({
    eligible: options,
    monthlyIncome: user.kyc.monthlyIncome,
    occupation: user.kyc.occupation,
    downpaymentPct: cfg.downpaymentPct,
    markupPct,
    repaidLoans,
  })
}
