import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// POST /api/admin/confirm-installment { installmentId }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'payments')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const { installmentId } = await req.json()
  if (!installmentId) return NextResponse.json({ error: 'installmentId required' }, { status: 400 })

  const inst = await db.installment.findUnique({
    where: { id: installmentId },
    include: { loan: { include: { installments: true } } },
  })
  if (!inst) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })

  const updated = await db.installment.update({
    where: { id: installmentId },
    data: { status: 'PAID', paidAt: new Date() },
  })

  const loan = inst.loan
  const loanUpdate: any = {}

  if (inst.installmentNumber === 1 && loan.status === 'FIRST_INSTALLMENT_PENDING') {
    loanUpdate.firstInstallmentPaid = true
    loanUpdate.firstInstallmentPaidAt = new Date()
    loanUpdate.status = 'ACTIVE'
    loanUpdate.withdrawalUnlocked = true

    await db.notification.create({
      data: {
        userId: loan.userId,
        title: 'Withdrawal Unlocked!',
        body: `Congratulations! Your 1st installment is confirmed. You can now withdraw your loan amount of Rs. ${loan.amount} via ${loan.withdrawalMethod}.`,
        type: 'WITHDRAWAL_UNLOCKED',
      },
    })
  }

  const refreshed = await db.installment.findMany({ where: { loanId: loan.id } })
  if (refreshed.every(i => i.status === 'PAID')) {
    loanUpdate.status = 'COMPLETED'
    await db.notification.create({
      data: {
        userId: loan.userId,
        title: 'Loan Completed!',
        body: `Congratulations! You have successfully paid off your loan of Rs. ${loan.amount}. You are now eligible for higher loan amounts.`,
        type: 'LOAN_COMPLETED',
      },
    })
  }

  if (Object.keys(loanUpdate).length > 0) {
    await db.loan.update({ where: { id: loan.id }, data: loanUpdate })
  }

  const next = refreshed.find(i => i.status !== 'PAID' && i.id !== installmentId)
  if (next) {
    await db.notification.create({
      data: {
        userId: loan.userId,
        title: `Installment #${next.installmentNumber} Reminder`,
        body: `Your next installment of Rs. ${next.amount} is due on ${new Date(next.dueDate).toLocaleDateString('en-PK')}. Please pay on time to avoid late fees.`,
        type: 'INSTALLMENT_REMINDER',
      },
    })
  }

  await logActivity({
    type: 'INSTALLMENT_CONFIRMED',
    actor: admin.username,
    action: `Confirmed installment #${inst.installmentNumber}`,
    details: `Rs. ${inst.amount.toLocaleString()} for loan ${loan.id}`,
    userId: loan.userId,
    loanId: loan.id,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, installment: updated })
}
