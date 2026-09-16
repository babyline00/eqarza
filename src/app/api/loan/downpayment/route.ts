import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

// POST /api/loan/downpayment { loanId, proofImage }
export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loanId, proofImage } = await req.json()
  if (!loanId || !proofImage) {
    return NextResponse.json({ error: 'Missing loanId or proofImage' }, { status: 400 })
  }

  const loan = await db.loan.findUnique({ where: { id: loanId } })
  if (!loan || loan.userId !== user.id) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }
  if (loan.downpaymentStatus === 'APPROVED' || ['ACTIVE', 'COMPLETED'].includes(loan.status)) {
    return NextResponse.json({ error: 'Downpayment already processed' }, { status: 400 })
  }

  const updated = await db.loan.update({
    where: { id: loanId },
    data: {
      downpaymentProof: proofImage,
      downpaymentUploadedAt: new Date(),
      downpaymentStatus: 'PENDING',
      downpaymentAdminNote: null,
      downpaymentReviewedAt: null,
      // Re-upload after rejection must restore the normal approval path
      status: loan.status === 'REJECTED' ? 'DOWNPAYMENT_PENDING' : loan.status,
    },
  })

  return NextResponse.json({ ok: true, loan: updated })
}

// GET /api/loan/downpayment?loanId=...
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const loanId = url.searchParams.get('loanId')
  if (!loanId) return NextResponse.json({ error: 'loanId required' }, { status: 400 })

  const loan = await db.loan.findUnique({ where: { id: loanId } })
  if (!loan || loan.userId !== user.id) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }
  return NextResponse.json({ loan })
}
