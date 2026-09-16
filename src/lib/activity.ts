import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export interface ActivityInput {
  type: string
  actor: string
  action: string
  details?: string | null
  userId?: string | null
  loanId?: string | null
  ip?: string | null
}

// Records an entry in the admin activity log. Failures are swallowed so that
// logging never breaks (or slows down) the actual admin action.
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        type: input.type,
        actor: input.actor || 'system',
        action: input.action,
        details: input.details || null,
        userId: input.userId || null,
        loanId: input.loanId || null,
        ip: input.ip || null,
      },
    })
  } catch (e: any) {
    console.warn('[activity] failed to log entry:', e?.message || e)
  }
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}