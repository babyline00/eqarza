import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

function accountPayload(a: any) {
  return {
    id: a.id,
    method: a.method,
    accountTitle: a.accountTitle,
    accountNumber: a.accountNumber,
    color: a.color,
    isActive: a.isActive,
    sortOrder: a.sortOrder,
  }
}

// GET /api/admin/bank-details  -> all deposit accounts (admin auth)
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const accounts = await db.depositAccount.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ accounts: accounts.map(accountPayload) })
}

// POST /api/admin/bank-details { method, accountTitle, accountNumber, color?, isActive? }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const body = await req.json()
  if (!body.method?.trim() || !body.accountTitle?.trim() || !body.accountNumber?.trim()) {
    return NextResponse.json({ error: 'Method, account title and account number are required' }, { status: 400 })
  }

  const maxOrder = await db.depositAccount.aggregate({ _max: { sortOrder: true } })
  const account = await db.depositAccount.create({
    data: {
      method: body.method.trim(),
      accountTitle: body.accountTitle.trim(),
      accountNumber: body.accountNumber.trim(),
      color: body.color?.trim() || '#00A651',
      isActive: body.isActive !== false,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })

  await logActivity({ type: 'BANK_ADDED', actor: admin.username, action: 'Added deposit account', details: `${account.method} — ${account.accountTitle} (${account.accountNumber})`, ip: getClientIp(req) })

  return NextResponse.json({ ok: true, account: accountPayload(account) })
}

// PATCH /api/admin/bank-details { id, ...fields }
export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.depositAccount.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const account = await db.depositAccount.update({
    where: { id: body.id },
    data: {
      method: body.method?.trim() ?? existing.method,
      accountTitle: body.accountTitle?.trim() ?? existing.accountTitle,
      accountNumber: body.accountNumber?.trim() ?? existing.accountNumber,
      color: body.color?.trim() ?? existing.color,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : existing.isActive,
      sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : existing.sortOrder,
    },
  })

  await logActivity({ type: 'BANK_UPDATED', actor: admin.username, action: 'Updated deposit account', details: `${account.method} — ${account.accountTitle}`, ip: getClientIp(req) })

  return NextResponse.json({ ok: true, account: accountPayload(account) })
}

// DELETE /api/admin/bank-details { id }
export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.depositAccount.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  await db.depositAccount.delete({ where: { id } })

  await logActivity({ type: 'BANK_DELETED', actor: admin.username, action: 'Deleted deposit account', details: `${existing.method} — ${existing.accountTitle}`, ip: getClientIp(req) })

  return NextResponse.json({ ok: true })
}