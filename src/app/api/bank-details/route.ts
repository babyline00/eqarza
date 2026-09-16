import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'
import { PLATFORM_CONFIG } from '@/lib/config'

// GET /api/bank-details  (user auth)
// Returns the active deposit accounts shown on the downpayment /
// installment screens. Seeds defaults the first time it runs.
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let count = await db.depositAccount.count()
  if (count === 0) {
    await db.depositAccount.createMany({
      data: PLATFORM_CONFIG.depositAccounts.map((acc, i) => ({
        method: acc.method,
        accountTitle: acc.accountTitle,
        accountNumber: acc.accountNumber,
        color: acc.color,
        sortOrder: i,
      })),
    })
    count = await db.depositAccount.count()
  }

  const accounts = await db.depositAccount.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ accounts })
}