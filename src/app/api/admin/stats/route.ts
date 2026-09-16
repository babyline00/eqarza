import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { unstable_cache } from 'next/cache'

// Cache dashboard stats for 30 seconds. This means thousands of dashboard
// refreshes don't create thousands of DB queries.
const getCachedStats = unstable_cache(
  async () => {
    const [totalUsers, totalLoans, pendingKyc, pendingWithdrawals] = await Promise.all([
      db.user.count({ where: { deleted: false } }),
      db.loan.count(),
      db.kyc.count({ where: { kycStatus: 'PENDING' } }),
      db.loan.count({ where: { withdrawalStatus: 'PENDING', withdrawalUnlocked: true, status: { notIn: ['REJECTED', 'COMPLETED'] } } }),
    ])

    const [loanAgg, dpAgg, instAgg] = await Promise.all([
      db.loan.aggregate({ _count: { _all: true }, _sum: { withdrawnAmount: true } }),
      db.loan.aggregate({ _count: { _all: true }, _sum: { downpaymentAmount: true }, where: { downpaymentProof: { not: null }, downpaymentStatus: 'APPROVED' } }),
      db.installment.aggregate({ _count: { _all: true }, _sum: { amount: true }, where: { status: 'PAID', proofImage: { not: null } } }),
    ])

    return {
      totalUsers,
      totalLoans: loanAgg._count._all,
      pendingKyc,
      pendingWithdrawals,
      totalDisbursed: loanAgg._sum.withdrawnAmount ?? 0,
      totalReceived: (dpAgg._sum.downpaymentAmount ?? 0) + (instAgg._sum.amount ?? 0),
      pendingPayments: dpAgg._count._all,
      approvedPayments: dpAgg._count._all,
    }
  },
  ['admin-dashboard-stats'],
  { revalidate: 30 }
)

// GET /api/admin/stats — dashboard overview numbers (production-parity)
// Uses database aggregation (count, sum) instead of fetching all records.
// All queries run in parallel via Promise.all.
// Results are cached for 30 seconds to avoid repeated DB hits on refresh.
// Super admin receives the full platform picture. Staff receive ONLY
// the numbers of the modules their role is allowed to manage.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stats = await getCachedStats()

  const full = {
    ...stats,
    pendingApprovals: stats.pendingKyc + stats.pendingPayments,
    approvedPayments: stats.approvedPayments,
    rejectedPayments: 0,
    activeLoans: 0,
    completedLoans: 0,
  }

  // Super admin (and any non-staff admin identity) gets everything
  if (!admin.isStaff) return NextResponse.json(full)

  // Staff: scope the payload to the modules this role manages.
  const scoped: Record<string, number> = {}
  let pendingApprovals = 0
  if (hasPerm(admin, 'users')) scoped.totalUsers = full.totalUsers
  if (hasPerm(admin, 'kyc')) {
    scoped.pendingKyc = full.pendingKyc
    pendingApprovals += full.pendingKyc
  }
  if (hasPerm(admin, 'payments')) {
    scoped.pendingPayments = full.pendingPayments
    scoped.approvedPayments = full.approvedPayments
    scoped.totalReceived = full.totalReceived
    pendingApprovals += full.pendingPayments
  }
  if (hasPerm(admin, 'loans')) {
    scoped.totalLoans = full.totalLoans
    scoped.totalDisbursed = full.totalDisbursed
  }
  if (hasPerm(admin, 'withdrawals')) scoped.pendingWithdrawals = full.pendingWithdrawals
  if (hasPerm(admin, 'kyc') || hasPerm(admin, 'payments')) {
    scoped.pendingApprovals = pendingApprovals
  }

  return NextResponse.json(scoped)
}