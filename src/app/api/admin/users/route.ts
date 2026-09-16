import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

// GET /api/admin/users
// Read access also covers staff with the kyc permission: KYC cases are
// attached to user records, so reviewers need to list users with their KYC.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'users') && !hasPerm(admin, 'kyc')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const users = await db.user.findMany({
    include: {
      kyc: true,
      loans: { include: { installments: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ users })
}

// PATCH /api/admin/users { id, action }
// actions: block | unblock | delete | restore | reset_kyc
export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'users')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const body = await req.json()
  const { id, action } = body
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const user = await db.user.findUnique({ where: { id }, include: { kyc: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  switch (action) {
    case 'block': {
      await db.user.update({ where: { id }, data: { blocked: true } })
      await db.notification.create({
        data: {
          userId: id,
          title: 'Account Blocked',
          body: 'Your account has been blocked. Contact support if you believe this is a mistake.',
          type: 'ACCOUNT_BLOCKED',
        },
      })
      await logActivity({ type: 'USER_BLOCKED', actor: admin.username, action: 'Blocked user', details: `${user.phone} (${id})`, userId: id, ip: getClientIp(req) })
      return NextResponse.json({ ok: true, action: 'blocked' })
    }
    case 'unblock': {
      await db.user.update({ where: { id }, data: { blocked: false } })
      await logActivity({ type: 'USER_UNBLOCKED', actor: admin.username, action: 'Unblocked user', details: `${user.phone} (${id})`, userId: id, ip: getClientIp(req) })
      return NextResponse.json({ ok: true, action: 'unblocked' })
    }
    case 'delete': {
      // Hard delete the user from the database along with all related records
      const loans = await db.loan.findMany({ where: { userId: id }, select: { id: true } })
      await db.notification.deleteMany({ where: { userId: id } })
      await db.kyc.deleteMany({ where: { userId: id } })
      for (const l of loans) {
        await db.installment.deleteMany({ where: { loanId: l.id } })
      }
      await db.loan.deleteMany({ where: { userId: id } })
      await db.user.delete({ where: { id } })
      await logActivity({ type: 'USER_DELETED', actor: admin.username, action: 'Deleted user', details: `${user.phone} (${id})`, userId: id, ip: getClientIp(req) })
      return NextResponse.json({ ok: true, action: 'deleted' })
    }
    case 'restore': {
      await db.user.update({ where: { id }, data: { blocked: false, deleted: false } })
      await logActivity({ type: 'USER_RESTORED', actor: admin.username, action: 'Restored user', details: `${user.phone} (${id})`, userId: id, ip: getClientIp(req) })
      return NextResponse.json({ ok: true, action: 'restored' })
    }
    case 'reset_kyc': {
      if (!user.kyc) return NextResponse.json({ error: 'User has no KYC to reset' }, { status: 400 })
      await db.kyc.update({
        where: { userId: id },
        data: { kycStatus: 'PENDING', kycReviewedAt: null, kycAdminNote: null },
      })
      await db.notification.create({
        data: {
          userId: id,
          title: 'KYC Reset',
          body: 'Your KYC has been reset by our team. Please review your information and resubmit.',
          type: 'KYC_RESET',
        },
      })
      await logActivity({ type: 'KYC_RESET', actor: admin.username, action: 'Reset KYC', details: `${user.phone} (${id})`, userId: id, ip: getClientIp(req) })
      return NextResponse.json({ ok: true, action: 'kyc_reset' })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
