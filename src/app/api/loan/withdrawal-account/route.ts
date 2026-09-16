import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

// POST /api/loan/withdrawal-account
export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loanId, method, accountTitle, accountNumber, bank } = await req.json()
  if (!loanId || !method || !accountTitle || !accountNumber) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['JazzCash', 'EasyPaisa', 'Bank'].includes(method)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
  }

  const loan = await db.loan.findUnique({ where: { id: loanId } })
  if (!loan || loan.userId !== user.id) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }
  if (['ACTIVE', 'COMPLETED', 'REJECTED', 'FIRST_INSTALLMENT_PENDING'].includes(loan.status) || loan.withdrawalUnlocked) {
    return NextResponse.json({ error: 'Withdrawal account can only be set before downpayment approval' }, { status: 400 })
  }

  const updated = await db.loan.update({
    where: { id: loanId },
    data: {
      withdrawalMethod: method,
      withdrawalAccountTitle: accountTitle,
      withdrawalAccountNumber: accountNumber,
      withdrawalBank: method === 'Bank' ? bank : null,
    },
  })

  return NextResponse.json({ ok: true, loan: updated })
}
