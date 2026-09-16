import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'

// GET /api/admin/activity?type=...&limit=... -> recent admin activity logs
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type') || undefined
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 200, 500)

  const logs = await db.activityLog.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const types = await db.activityLog.groupBy({
    by: ['type'],
    _count: { _all: true },
    orderBy: { _count: { type: 'desc' } },
  })

  return NextResponse.json({ logs, types: types.map((t) => t.type) })
}