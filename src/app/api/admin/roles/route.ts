import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

function parsePermissions(body: any) {
  return {
    canUsers: !!body?.canUsers,
    canPayments: !!body?.canPayments,
    canLoans: !!body?.canLoans,
    canWithdrawals: !!body?.canWithdrawals,
    canKyc: !!body?.canKyc,
  }
}

// GET /api/admin/roles -> all staff roles with assigned staff counts
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const roles = await db.staffRole.findMany({
    orderBy: { createdAt: 'asc' },
    include: { staff: { select: { id: true } } },
  })
  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      canUsers: r.canUsers,
      canPayments: r.canPayments,
      canLoans: r.canLoans,
      canWithdrawals: r.canWithdrawals,
      canKyc: r.canKyc,
      staffCount: r.staff.length,
      createdAt: r.createdAt,
    })),
  })
}

// POST /api/admin/roles { action: 'create' | 'update' | 'delete', ... }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'create') {
    const name = String(body?.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Role name is required' }, { status: 400 })
    if (await db.staffRole.findUnique({ where: { name } })) {
      return NextResponse.json({ error: `A role named \"${name}\" already exists` }, { status: 409 })
    }
    const role = await db.staffRole.create({ data: { name, ...parsePermissions(body) } })
    await logActivity({
      type: 'ROLE_CREATED',
      actor: admin!.username,
      action: 'Created staff role',
      details: `${name}`,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, role })
  }

  if (action === 'update') {
    const id = String(body?.id || '')
    const role = await db.staffRole.findUnique({ where: { id } })
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    const name = String(body?.name || role.name).trim()
    if (!name) return NextResponse.json({ error: 'Role name is required' }, { status: 400 })
    if (name !== role.name && (await db.staffRole.findUnique({ where: { name } }))) {
      return NextResponse.json({ error: `A role named \"${name}\" already exists` }, { status: 409 })
    }
    const updated = await db.staffRole.update({
      where: { id },
      data: { name, ...parsePermissions(body) },
    })
    await logActivity({
      type: 'ROLE_UPDATED',
      actor: admin!.username,
      action: 'Updated staff role',
      details: `${name} (users:${Number(updated.canUsers)} payments:${Number(updated.canPayments)} loans:${Number(updated.canLoans)} withdrawals:${Number(updated.canWithdrawals)} kyc:${Number(updated.canKyc)})`,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true, role: updated })
  }

  if (action === 'delete') {
    const id = String(body?.id || '')
    const role = await db.staffRole.findUnique({ where: { id }, include: { staff: true } })
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    if (role.staff.length > 0) {
      return NextResponse.json(
        { error: `${role.staff.length} staff account(s) still use this role. Reassign or delete them first.` },
        { status: 400 }
      )
    }
    await db.staffRole.delete({ where: { id } })
    await logActivity({
      type: 'ROLE_DELETED',
      actor: admin!.username,
      action: 'Deleted staff role',
      details: role.name,
      ip: getClientIp(req),
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action (create/update/delete)' }, { status: 400 })
}
