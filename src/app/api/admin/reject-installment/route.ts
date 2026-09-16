import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// POST /api/admin/reject-installment { installmentId, note }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'payments')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const { installmentId, note } = await req.json()
  if (!installmentId) return NextResponse.json({ error: 'installmentId required' }, { status: 400 })

  const inst = await db.installment.findUnique({
    where: { id: installmentId },
    include: { loan: true },
  })
  if (!inst) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
  if (inst.status === 'PAID') {
    return NextResponse.json({ error: 'This installment is already confirmed as paid' }, { status: 400 })
  }

  await db.installment.update({
    where: { id: installmentId },
    data: {
      status: 'PENDING',
      proofImage: null,
      paidAt: null,
    },
  })

  await db.notification.create({
    data: {
      userId: inst.loan.userId,
      title: `Installment #${inst.installmentNumber} Rejected`,
      body: `Your installment proof was rejected. Reason: ${note || 'Not specified'}. Please re-upload a valid proof for week ${inst.installmentNumber}.`,
      type: 'INSTALLMENT_REJECTED',
    },
  })

  await logActivity({
    type: 'INSTALLMENT_REJECTED',
    actor: admin.username,
    action: `Rejected installment #${inst.installmentNumber}`,
    details: `For loan ${inst.loanId}${note ? ` — ${note}` : ''}`,
    userId: inst.loan.userId,
    loanId: inst.loanId,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}