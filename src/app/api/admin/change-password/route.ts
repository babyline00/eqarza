import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { logActivity, getClientIp } from '@/lib/activity'

// POST /api/admin/change-password { currentPassword, newPassword }
// Requires a valid admin token. Because the admin token IS the password hash,
// the returned token (new hash) must be stored by the client to stay logged in.
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password required' }, { status: 400 })
  }

  const adminRow = await db.admin.findUnique({ where: { id: admin.id } })
  if (!adminRow || !verifyPassword(String(currentPassword), adminRow.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }

  const newHash = hashPassword(String(newPassword))
  await db.admin.update({
    where: { id: admin.id },
    data: { passwordHash: newHash },
  })

  await logActivity({ type: 'PASSWORD_CHANGED', actor: admin.username, action: 'Changed password', details: 'Admin password changed', ip: getClientIp(req) })

  return NextResponse.json({
    ok: true,
    token: newHash,
    username: admin.username,
  })
}