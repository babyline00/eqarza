import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromReq } from '@/lib/session'

// GET /api/admin/me -> identity of the current super admin or staff session,
// including the effective module permissions (null = super admin = full access).
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromReq(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({
      username: admin.username,
      isStaff: admin.isStaff,
      roleName: admin.roleName || 'Super Admin',
      permissions: admin.permissions, // null for super admin
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
