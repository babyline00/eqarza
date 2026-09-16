import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// POST /api/admin/reject-downpayment { loanId, note }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'payments')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const { loanId, note } = await req.json()
  if (!loanId) return NextResponse.json({ error: 'loanId required' }, { status: 400 })

  const loan = await db.loan.findUnique({ where: { id: loanId } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  if (loan.downpaymentStatus === 'APPROVED' || ['ACTIVE', 'COMPLETED'].includes(loan.status)) {
    return NextResponse.json({ error: 'This downpayment is already processed' }, { status: 400 })
  }

  const updated = await db.loan.update({
    where: { id: loanId },
    data: {
      downpaymentStatus: 'REJECTED',
      downpaymentReviewedAt: new Date(),
      downpaymentAdminNote: note || 'Rejected by admin',
      status: 'REJECTED',
    },
  })

  await db.notification.create({
    data: {
      userId: loan.userId,
      title: 'Downpayment Rejected',
      body: `Your downpayment proof was rejected. Reason: ${note || 'Not specified'}. Please re-upload a valid proof.`,
      type: 'DOWNPAYMENT_REJECTED',
    },
  })

  await logActivity({
    type: 'DOWNPAYMENT_REJECTED',
    actor: admin.username,
    action: 'Rejected downpayment',
    details: `For loan ${loanId}${note ? ` — ${note}` : ''}`,
    userId: loan.userId,
    loanId,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, loan: updated })
}
