import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// GET /api/admin/loans
// Read access also covers staff with the payments permission: payment
// approvals need the loan + installment records to verify proofs against.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'loans') && !hasPerm(admin, 'payments')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const loans = await db.loan.findMany({
    include: {
      user: true,
      installments: { orderBy: { installmentNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: loans.length,
    pendingDownpayments: loans.filter(l => l.downpaymentStatus === 'PENDING' && l.downpaymentProof).length,
    activeLoans: loans.filter(l => l.status === 'ACTIVE').length,
    completedLoans: loans.filter(l => l.status === 'COMPLETED').length,
    totalDisbursed: loans.filter(l => l.withdrawalUnlocked).reduce((s, l) => s + (l.amount || 0), 0),
    pendingInstallmentProofs: 0,
  }

  for (const l of loans) {
    stats.pendingInstallmentProofs += l.installments.filter(i => i.proofImage && i.status !== 'PAID').length
  }

  return NextResponse.json({ loans, stats })
}

// PATCH /api/admin/loans { id, action: 'mark_repaid' }
// Marks every installment PAID and completes the loan.
export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'loans')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const body = await req.json()
  const { id, action } = body
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const loan = await db.loan.findUnique({ where: { id }, include: { user: true, installments: true } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  if (action === 'mark_repaid') {
    if (loan.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Loan is already fully repaid' }, { status: 400 })
    }
    await db.installment.updateMany({
      where: { loanId: id },
      data: { status: 'PAID', paidAt: new Date() },
    })
    await db.loan.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })
    await db.notification.create({
      data: {
        userId: loan.userId,
        title: 'Loan Repaid',
        body: `Your loan of PKR ${loan.amount.toLocaleString()} has been fully repaid. Thank you! You now qualify for a higher loan with reduced markup next time.`,
        type: 'LOAN_REPAID',
      },
    })
    await logActivity({
      type: 'LOAN_REPAID',
      actor: admin.username,
      action: 'Marked loan as repaid',
      details: `${loan.user.phone} — PKR ${loan.amount.toLocaleString()}`,
      userId: loan.userId,
      loanId: loan.id,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, action: 'marked_repaid' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
