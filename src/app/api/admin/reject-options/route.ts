import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromReq, hasPerm } from '@/lib/session'
import { setSetting, getSetting, invalidateSetting } from '@/lib/settings'
import { logActivity, getClientIp } from '@/lib/activity'

// Manageable rejection-reason lists for KYC Review and Payment Approvals.
// Custom options are persisted in the Setting table; defaults are merged in
// by the client. "Other" is always available for a free-text note.
const KYC_KEY = 'kyc_reject_reasons'
const PAYMENT_KEY = 'payment_reject_reasons'

async function readList(key: string): Promise<string[]> {
  const raw = await getSetting(key)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => x === 'Other' || (typeof x === 'string' && x.trim().length > 0)) : []
  } catch {
    return []
  }
}

// GET /api/admin/reject-options -> { kyc: [...custom], payment: [...custom] }
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    kyc: await readList(KYC_KEY),
    payment: await readList(PAYMENT_KEY),
  })
}

// POST /api/admin/reject-options { kind: 'kyc'|'payment', action: 'add'|'remove', reason }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const kind = body?.kind === 'kyc' ? 'kyc' : body?.kind === 'payment' ? 'payment' : null
  const action = body?.action
  const reason = String(body?.reason || '').trim()

  if (!kind) return NextResponse.json({ error: "kind must be 'kyc' or 'payment'" }, { status: 400 })
  // Staff may only manage the list of the module they are allowed to work in
  if (admin.isStaff && !hasPerm(admin, kind === 'kyc' ? 'kyc' : 'payments')) {
    return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })
  }

  const key = kind === 'kyc' ? KYC_KEY : PAYMENT_KEY
  const list = await readList(key)

  if (action === 'add') {
    if (!reason) return NextResponse.json({ error: 'Reason text is required' }, { status: 400 })
    if (reason.length > 120) return NextResponse.json({ error: 'Keep the reason under 120 characters' }, { status: 400 })
    if (list.includes(reason)) return NextResponse.json({ error: 'This option already exists' }, { status: 409 })
    const next = [...list, reason]
    await setSetting(key, JSON.stringify(next))
  } else if (action === 'remove') {
    if (reason === 'Other') return NextResponse.json({ error: 'The "Other" option cannot be removed' }, { status: 400 })
    const next = list.filter((r) => r !== reason)
    await setSetting(key, JSON.stringify(next))
  } else {
    return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 })
  }

  invalidateSetting(key)
  await logActivity({
    type: 'REJECT_OPTIONS_UPDATED',
    actor: admin.username,
    action: action === 'add' ? 'Added rejection reason option' : 'Removed rejection reason option',
    details: `${kind}: ${reason}`,
    ip: getClientIp(req),
  })
  return NextResponse.json({ ok: true, options: await readList(key) })
}
