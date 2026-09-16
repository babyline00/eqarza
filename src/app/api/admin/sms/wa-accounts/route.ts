import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'

// POST /api/admin/sms/wa-accounts  { config?: { matrixsender: { secret, endpoint } } }
// Lists the WhatsApp accounts linked to the MatrixSender account via the public API.
// MatrixSender links are done in its own dashboard (WhatsApp section); this endpoint
// only discovers which accounts exist so the admin can pick the right one,
// and surfaces permission errors (e.g. missing get_wa_accounts API permission).
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const config = body?.config
  const secret = (config?.matrixsender?.secret || '').trim()
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'MatrixSender API secret not configured' }, { status: 400 })
  }

  let endpoint = (config?.matrixsender?.endpoint || process.env.MATRIXSENDER_ENDPOINT || '').trim()
  if (!endpoint) endpoint = 'https://matrixsender.com/api/wa.accounts'
  if (endpoint.includes('/send')) endpoint = endpoint.replace(/\/api\/send\/[a-z]+$/, '/api')

  const url = `${endpoint.replace(/\/+$/, '')}/get/wa.accounts`

  try {
    const res = await fetch(`${url}?secret=${encodeURIComponent(secret)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // non-JSON response
    }

    if (json) {
      const status = Number(json.status)
      if (status === 200 && Array.isArray(json.data)) {
        const accounts = json.data
          .map((a: any) => {
            if (typeof a === 'string') return a
            return a?.account || a?.name || a?.number || a?.id || String(a)
          })
          .filter(Boolean)
        return NextResponse.json({ ok: true, accounts, raw: text })
      }
      return NextResponse.json({
        ok: false,
        status: json.status ?? null,
        message: json.message ?? undefined,
        raw: text,
        error:
          json.status === 403
            ? 'Your MatrixSender API key lacks the get_wa_accounts permission. Enable it in MatrixSender → Tools → API Keys.'
            : undefined,
      })
    }

    return NextResponse.json({ ok: false, error: `Non-JSON response: ${text.slice(0, 200)}`, raw: text })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to query WhatsApp accounts' })
  }
}