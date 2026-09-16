import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// GET /api/admin/withdrawals?filter=PENDING|PAID|REJECTED|ALL
// A withdrawal request = an unlocked loan awaiting disbursement.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'withdrawals')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const filter = req.nextUrl.searchParams.get('filter') || 'PENDING'
  const where =
    filter === 'PENDING'
      ? { withdrawalUnlocked: true, withdrawalStatus: 'PENDING', status: { notIn: ['REJECTED'] } }
      : filter === 'PAID'
        ? { withdrawalStatus: 'PAID' }
        : filter === 'REJECTED'
          ? { withdrawalStatus: 'REJECTED' }
          : { withdrawalUnlocked: true, status: { notIn: ['DRAFT', 'DOWNPAYMENT_PENDING'] } }

  const loans = await db.loan.findMany({
    where,
    include: { user: { include: { kyc: { select: { cnic: true } } } } },
    orderBy: { updatedAt: 'desc' },
  })

  const withdrawals = loans.map((l) => ({
    id: l.id,
    amount: l.withdrawnAmount ?? l.amount,
    principalAmount: l.amount,
    method: l.withdrawalMethod,
    accountTitle: l.withdrawalAccountTitle,
    accountNumber: l.withdrawalAccountNumber,
    bank: l.withdrawalBank,
    status: l.withdrawalStatus,
    txnId: l.withdrawalTxnId,
    adminNote: l.withdrawalAdminNote,
    requestedAt: l.firstInstallmentPaidAt || l.updatedAt,
    reviewedAt: l.withdrawalReviewedAt,
    loanStatus: l.status,
    user: { id: l.user.id, name: l.user.name, phone: l.user.phone, cnic: l.user.kyc?.cnic || null },
  }))

  const counts = {
    pending: await db.loan.count({ where: { withdrawalUnlocked: true, withdrawalStatus: 'PENDING', status: { notIn: ['REJECTED'] } } }),
    paid: await db.loan.count({ where: { withdrawalStatus: 'PAID' } }),
    rejected: await db.loan.count({ where: { withdrawalStatus: 'REJECTED' } }),
    all: await db.loan.count({ where: { withdrawalUnlocked: true, status: { notIn: ['DRAFT', 'DOWNPAYMENT_PENDING'] } } }),
  }

  return NextResponse.json({ withdrawals, counts })
}

// PATCH /api/admin/withdrawals { id, action: 'mark_paid' | 'reject', txnId?, note? }
export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'withdrawals')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const body = await req.json()
  const { id, action, txnId, note } = body
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const loan = await db.loan.findUnique({ where: { id }, include: { user: true } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  if (!loan.withdrawalUnlocked) {
    return NextResponse.json({ error: 'Withdrawal is not unlocked for this loan yet' }, { status: 400 })
  }

  if (action === 'mark_paid') {
    if (!txnId || !String(txnId).trim()) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }
    await db.loan.update({
      where: { id },
      data: {
        withdrawalStatus: 'PAID',
        withdrawalTxnId: String(txnId).trim(),
        withdrawalReviewedAt: new Date(),
        withdrawalAdminNote: note || null,
        withdrawnAmount: loan.withdrawnAmount ?? loan.amount,
        withdrawnAt: loan.withdrawnAt ?? new Date(),
      },
    })
    await db.notification.create({
      data: {
        userId: loan.userId,
        title: 'Loan Sent',
        body: `PKR ${(loan.withdrawnAmount ?? loan.amount).toLocaleString()} has been sent to your ${loan.withdrawalMethod || 'account'}. Transaction ID: ${String(txnId).trim()}`,
        type: 'WITHDRAWAL_PAID',
      },
    })
    await logActivity({
      type: 'WITHDRAWAL_PAID',
      actor: admin.username,
      action: 'Marked withdrawal paid',
      details: `${loan.user.phone} — PKR ${(loan.withdrawnAmount ?? loan.amount).toLocaleString()} — TXN ${String(txnId).trim()}`,
      userId: loan.userId,
      loanId: loan.id,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, action: 'paid' })
  }

  if (action === 'reject') {
    await db.loan.update({
      where: { id },
      data: {
        withdrawalStatus: 'REJECTED',
        withdrawalReviewedAt: new Date(),
        withdrawalAdminNote: note || 'Rejected & refunded by admin',
        status: 'REJECTED',
      },
    })
    await db.notification.create({
      data: {
        userId: loan.userId,
        title: 'Withdrawal Rejected',
        body: `Your loan disbursement of PKR ${loan.amount.toLocaleString()} was rejected. ${note ? 'Note: ' + note : 'Your security downpayment will be refunded.'}`,
        type: 'WITHDRAWAL_REJECTED',
      },
    })
    await logActivity({
      type: 'WITHDRAWAL_REJECTED',
      actor: admin.username,
      action: 'Rejected & refunded withdrawal',
      details: `${loan.user.phone} — PKR ${loan.amount.toLocaleString()}${note ? ' — ' + note : ''}`,
      userId: loan.userId,
      loanId: loan.id,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
