import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { hashPassword } from '@/lib/auth'
import { logActivity, getClientIp } from '@/lib/activity'

// GET /api/admin/staff -> all staff accounts (with role names)
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const staff = await db.staff.findMany({
    orderBy: { createdAt: 'desc' },
    include: { role: { select: { name: true } } },
  })
  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      username: s.username,
      blocked: s.blocked,
      roleId: s.roleId,
      roleName: s.role.name,
      createdAt: s.createdAt,
    })),
  })
}

// POST /api/admin/staff { action: 'create' | 'update' | 'delete' | 'reset_password' | 'toggle_block', ... }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'create') {
    const username = String(body?.username || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const roleId = String(body?.roleId || '')
    if (!username || !/^[a-z0-9_.]{3,24}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3-24 chars (letters, numbers, _ or .)' }, { status: 400 })
    }
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    const role = await db.staffRole.findUnique({ where: { id: roleId } })
    if (!role) return NextResponse.json({ error: 'Please pick a valid role' }, { status: 400 })
    if (await db.staff.findUnique({ where: { username } })) {
      return NextResponse.json({ error: `Staff username \"${username}\" is already taken` }, { status: 409 })
    }
    if (await db.admin.findUnique({ where: { username } })) {
      return NextResponse.json({ error: 'That username is reserved for the super admin' }, { status: 409 })
    }
    const staff = await db.staff.create({
      data: { username, passwordHash: hashPassword(password), roleId },
    })
    await logActivity({
      type: 'STAFF_CREATED',
      actor: admin!.username,
      action: 'Created staff account',
      details: `${username} (role: ${role.name})`,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, staff: { id: staff.id, username: staff.username } })
  }

  if (action === 'update') {
    const id = String(body?.id || '')
    const staff = await db.staff.findUnique({ where: { id } })
    if (!staff) return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    const data: any = {}
    if (body?.roleId) {
      const role = await db.staffRole.findUnique({ where: { id: String(body.roleId) } })
      if (!role) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      data.roleId = role.id
    }
    if (typeof body?.blocked === 'boolean') data.blocked = body.blocked
    await db.staff.update({ where: { id }, data })
    await logActivity({
      type: 'STAFF_UPDATED',
      actor: admin!.username,
      action: 'Updated staff account',
      details: staff.username,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reset_password') {
    const id = String(body?.id || '')
    const password = String(body?.password || '')
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    const staff = await db.staff.findUnique({ where: { id } })
    if (!staff) return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    await db.staff.update({ where: { id }, data: { passwordHash: hashPassword(password) } })
    await logActivity({
      type: 'STAFF_PASSWORD_RESET',
      actor: admin!.username,
      action: 'Reset staff password',
      details: staff.username,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const id = String(body?.id || '')
    const staff = await db.staff.findUnique({ where: { id } })
    if (!staff) return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    await db.staff.delete({ where: { id } })
    await logActivity({
      type: 'STAFF_DELETED',
      actor: admin!.username,
      action: 'Deleted staff account',
      details: staff.username,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action (create/update/reset_password/delete)' }, { status: 400 })
}
