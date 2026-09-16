import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

// GET /api/notifications
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-generate weekly reminders for active loans
  const activeLoan = user.loans.find(l => l.status === 'ACTIVE')
  if (activeLoan) {
    const now = new Date()
    const lastNotif = await db.notification.findFirst({
      where: { userId: user.id, type: 'WEEKLY_REMINDER' },
      orderBy: { createdAt: 'desc' },
    })
    if (!lastNotif || (now.getTime() - lastNotif.createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000) {
      const unpaid = activeLoan.installments.find(i => i.status !== 'PAID')
      if (unpaid) {
        await db.notification.create({
          data: {
            userId: user.id,
            title: `Weekly Installment Reminder`,
            body: `Your installment #${unpaid.installmentNumber} of Rs. ${unpaid.amount} is due on ${new Date(unpaid.dueDate).toLocaleDateString('en-PK')}. Please pay on time.`,
            type: 'WEEKLY_REMINDER',
          },
        })
      }
    }
  }

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ notifications })
}

// POST /api/notifications { id } -> mark as read
export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req, true)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const owned = await db.notification.findFirst({ where: { id, userId: user.id } })
  if (!owned) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

  await db.notification.update({
    where: { id },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
