import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { findUserByReferralCode } from '@/lib/referral'
import { getReferralBonus } from '@/lib/settings'
import { logActivity, getClientIp } from '@/lib/activity'

// POST /api/admin/approve-downpayment { loanId, note? }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'payments')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const { loanId, note } = await req.json()
  if (!loanId) return NextResponse.json({ error: 'loanId required' }, { status: 400 })

  const loan = await db.loan.findUnique({ where: { id: loanId }, include: { installments: true } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  if (loan.downpaymentStatus === 'APPROVED') {
    return NextResponse.json({ error: 'Already approved' }, { status: 400 })
  }
  if (['ACTIVE', 'COMPLETED'].includes(loan.status)) {
    return NextResponse.json({ error: 'Loan is already active or completed' }, { status: 400 })
  }
  if (!loan.downpaymentProof) {
    return NextResponse.json({ error: 'User has not uploaded a downpayment proof yet' }, { status: 400 })
  }

  await db.loan.update({
    where: { id: loanId },
    data: {
      downpaymentStatus: 'APPROVED',
      downpaymentReviewedAt: new Date(),
      downpaymentAdminNote: note || 'Approved by admin',
      status: 'FIRST_INSTALLMENT_PENDING',
    },
  })

  if (loan.installments.length === 0) {
    const now = new Date()
    const data: {
      loanId: string
      installmentNumber: number
      amount: number
      dueDate: Date
      status: string
    }[] = []
    for (let i = 1; i <= 4; i++) {
      const due = new Date(now)
      due.setDate(due.getDate() + 7 * i)
      data.push({
        loanId,
        installmentNumber: i,
        amount: loan.weeklyInstallment,
        dueDate: due,
        status: 'PENDING',
      })
    }
    await db.installment.createMany({ data })
  }

  // Referral reward: when a loan that was linked to a referral code is confirmed
  // (downpayment approved), credit the referrer.
  if (loan.referredCode) {
    const referrer = await findUserByReferralCode(loan.referredCode)
    const referredUser = await db.user.findUnique({ where: { id: loan.userId } })
    if (referrer && referrer.id !== loan.userId) {
      const reward = await getReferralBonus()
      await db.user.update({
        where: { id: referrer.id },
        data: { rewardBalance: { increment: reward } },
      })
      await db.notification.create({
        data: {
          userId: referrer.id,
          title: 'Referral Reward Earned!',
          body: `🎉 You earned Rs. ${reward} reward because your referral ${referredUser?.name || referredUser?.phone} confirmed a loan. It will be credited against your next installment.`,
          type: 'REFERRAL_REWARD',
        },
      })
    }
  }

  await db.notification.create({
    data: {
      userId: loan.userId,
      title: 'Downpayment Approved',
      body: `Your 10% security downpayment has been approved. Please pay your 1st installment (Rs. ${loan.weeklyInstallment}) to unlock withdrawal.`,
      type: 'DOWNPAYMENT_APPROVED',
    },
  })

  const refreshed = await db.loan.findUnique({
    where: { id: loanId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })

  await logActivity({
    type: 'DOWNPAYMENT_APPROVED',
    actor: admin.username,
    action: 'Approved downpayment',
    details: `Rs. ${loan.downpaymentAmount?.toLocaleString()} for loan ${loanId}${note ? ` — ${note}` : ''}`,
    userId: loan.userId,
    loanId,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, loan: refreshed })
}
