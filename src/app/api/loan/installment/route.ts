import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

// POST /api/loan/installment { loanId, installmentId, proofImage }
export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loanId, installmentId, proofImage } = await req.json()
  if (!loanId || !installmentId || !proofImage) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { installments: true },
  })
  if (!loan || loan.userId !== user.id) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }

  const inst = loan.installments.find(i => i.id === installmentId)
  if (!inst) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
  if (inst.status === 'PAID') {
    return NextResponse.json({ error: 'Installment already paid' }, { status: 400 })
  }

  // Ordering guard: earlier installments must be paid before later ones can be submitted.
  if (inst.installmentNumber > 1) {
    const earlierUnpaid = loan.installments.some(i => i.installmentNumber < inst.installmentNumber && i.status !== 'PAID')
    if (earlierUnpaid) {
      return NextResponse.json({ error: 'Please complete earlier installments first' }, { status: 400 })
    }
  }

  // Installment #1 (unlock withdrawal) requires the downpayment to have been approved.
  if (inst.installmentNumber === 1 && loan.downpaymentStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Downpayment must be approved before paying the 1st installment' }, { status: 400 })
  }

  const updated = await db.installment.update({
    where: { id: installmentId },
    data: { proofImage },
  })

  return NextResponse.json({ ok: true, installment: updated })
}

// GET /api/loan/installment?loanId=...
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const loanId = url.searchParams.get('loanId')
  if (!loanId) return NextResponse.json({ error: 'loanId required' }, { status: 400 })

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
  if (!loan || loan.userId !== user.id) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }
  return NextResponse.json({ loan })
}
