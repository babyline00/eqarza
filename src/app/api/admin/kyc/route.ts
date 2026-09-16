import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'kyc')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const body = await req.json()
  const { userId, status, note } = body

  if (!userId || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'userId and valid status (APPROVED/REJECTED) required' }, { status: 400 })
  }

  const kyc = await db.kyc.findUnique({ where: { userId } })
  if (!kyc) return NextResponse.json({ error: 'KYC not found' }, { status: 404 })

  const updated = await db.kyc.update({
    where: { userId },
    data: {
      kycStatus: status,
      kycReviewedAt: new Date(),
      kycAdminNote: note || null,
    },
  })

  if (status === 'APPROVED') {
    await db.user.update({
      where: { id: userId },
      data: { name: kyc.fullName },
    })
  }

  await db.notification.create({
    data: {
      userId,
      title: status === 'APPROVED' ? 'KYC Approved' : 'KYC Rejected',
      body:
        status === 'APPROVED'
          ? 'Congratulations! Your KYC has been verified. You can now apply for a loan.'
          : `Your KYC could not be verified. Reason: ${note || 'Documents unclear'}. Please re-upload clear documents.`,
      type: status === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
    },
  })

  await logActivity({
    type: status === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
    actor: admin.username,
    action: status === 'APPROVED' ? 'Approved KYC' : 'Rejected KYC',
    details: note || null,
    userId,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, kyc: updated })
}

// DELETE /api/admin/kyc?userId=... — delete a KYC case (user account remains, can resubmit)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPerm(admin, 'kyc')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const kyc = await db.kyc.findUnique({ where: { userId } })
  if (!kyc) return NextResponse.json({ error: 'KYC not found' }, { status: 404 })

  await db.kyc.delete({ where: { userId } })

  await db.notification.create({
    data: {
      userId,
      title: 'KYC Case Removed',
      body: 'Your KYC submission was removed by our team. Please submit your documents again to continue.',
      type: 'KYC_RESET',
    },
  })

  await logActivity({
    type: 'KYC_DELETED',
    actor: admin.username,
    action: 'Deleted KYC case',
    details: kyc.fullName,
    userId,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
