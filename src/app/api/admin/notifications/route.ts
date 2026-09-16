import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm, isSuperAdmin } from '@/lib/session'

// GET /api/admin/notifications
// Ultra-light poll endpoint for real-time admin alerts. Returns ONLY id
// lists (no heavy nested data or image URLs) so the 20s polling loop costs
// almost nothing on shared hosting. The admin UI diffs these against its
// last-seen snapshot to fire toasts, pop-ups + sounds, and only does a full
// data reload when something actually changed.
//
// Permission-aware: staff accounts only receive alerts for the modules their
// role can actually open (kyc / payments / withdrawals / users / loans). A KYC
// officer, for example, will never be told about a new loan or a downpayment
// they have no access to. Super admin receives everything.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Loans back the Loans tab AND the Payments tab (downpayments + installment
  // proofs) — mirror the scoping the admin dashboard uses in its fetchData().
  const canLoans = isSuperAdmin(admin) || hasPerm(admin, 'loans') || hasPerm(admin, 'payments')
  // Users back the Users tab AND the KYC Review tab.
  const canUsers = isSuperAdmin(admin) || hasPerm(admin, 'users') || hasPerm(admin, 'kyc')

  const [loans, users] = await Promise.all([
    canLoans
      ? db.loan.findMany({
          select: {
            id: true,
            downpaymentStatus: true,
            downpaymentProof: true,
            installments: { select: { id: true, proofImage: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    canUsers
      ? db.user.findMany({
          select: {
            id: true,
            kyc: { select: { kycStatus: true, cnicFrontImage: true, selfieImage: true, updatedAt: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const pendingKyc = users.filter(
    (u) =>
      u.kyc &&
      (u.kyc.kycStatus === 'PENDING' || !u.kyc.kycStatus) &&
      (u.kyc.cnicFrontImage || u.kyc.selfieImage)
  )

  return NextResponse.json({
    loans: loans.map((l) => l.id),
    downpayments: loans.filter((l) => l.downpaymentStatus === 'PENDING' && l.downpaymentProof).map((l) => l.id),
    installments: loans.flatMap((l) => l.installments.filter((i) => i.proofImage && i.status !== 'PAID').map((i) => i.id)),
    users: users.map((u) => u.id),
    kyc: pendingKyc.map((u) => u.id),
    // id -> updatedAt(ms) so the admin UI can also detect document updates /
    // resubmissions on cases that were ALREADY pending (same id, newer docs)
    kycTs: Object.fromEntries(pendingKyc.map((u) => [u.id, u.kyc?.updatedAt ? new Date(u.kyc.updatedAt).getTime() : 0])),
  })
}