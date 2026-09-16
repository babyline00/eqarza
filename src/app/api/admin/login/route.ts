import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { getSetting, setSetting, invalidateSetting } from '@/lib/settings'
import { logActivity, getClientIp } from '@/lib/activity'

// Brute-force protection: after MAX_FAILS failed attempts from the same IP,
// the IP is locked out for LOCK_MINUTES minutes. State is persisted in the
// Setting table (key `admin_lock_<ip>`) so restarts don't reset it.
const MAX_FAILS = 5
const LOCK_MINUTES = 15
const LOCK_MS = LOCK_MINUTES * 60 * 1000

const lockKey = (ip: string) => `admin_lock_${ip}`

async function getLock(ip: string): Promise<{ fails: number; lockedUntil: number } | null> {
  const raw = await getSetting(lockKey(ip))
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (typeof data.fails === 'number' && typeof data.lockedUntil === 'number') return data
  } catch {
    // corrupt entry — treat as no lock
  }
  return null
}

async function setLock(ip: string, fails: number, lockedUntil: number) {
  await setSetting(lockKey(ip), JSON.stringify({ fails, lockedUntil }))
}

async function clearLock(ip: string) {
  // deleteMany (not delete) — never throws P2001 when the lock row doesn't exist
  await db.setting.deleteMany({ where: { key: lockKey(ip) } })
  invalidateSetting(lockKey(ip))
}

// POST /api/admin/login { username, password }
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const lock = await getLock(ip)
  const now = Date.now()

  if (lock && lock.lockedUntil > now) {
    return NextResponse.json(
      {
        error: `Too many failed attempts. Login is locked for ${LOCK_MINUTES} minutes.`,
        lockedFor: Math.ceil((lock.lockedUntil - now) / 1000),
      },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  const username = body?.username
  const password = body?.password
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  // Try super admin only — staff accounts are not allowed to access the admin console.
  const admin = await db.admin.findUnique({ where: { username } })
  const valid = !!admin && verifyPassword(password, admin.passwordHash)

  if (!valid) {
    // Check if the username belongs to a staff account and reject them
    const found = await db.staff.findUnique({ where: { username } })
    if (found) {
      await logActivity({
        type: 'ADMIN_LOGIN_FAILED',
        actor: found.username,
        action: 'Staff login attempt blocked',
        details: `Staff account "${found.username}" attempted to access admin console from ${ip}. Staff are not permitted to use the admin panel.`,
        ip,
      })
      return NextResponse.json({ error: 'Staff accounts are not permitted to access the admin console. Please contact the super admin.' }, { status: 403 })
    }

    const fails = (lock?.fails ?? 0) + 1
    const lockedUntil = fails >= MAX_FAILS ? now + LOCK_MS : 0
    await setLock(ip, fails, lockedUntil)
    await logActivity({
      type: lockedUntil ? 'ADMIN_LOGIN_LOCKED' : 'ADMIN_LOGIN_FAILED',
      actor: admin?.username || username || 'unknown',
      action: lockedUntil ? 'Locked after repeated failed logins' : 'Failed login attempt',
      details: lockedUntil ? `IP ${ip} locked for ${LOCK_MINUTES} minutes` : 'Invalid username or password',
      ip,
    })
    return NextResponse.json(
      {
        error: lockedUntil
          ? `Too many failed attempts. Login is locked for ${LOCK_MINUTES} minutes.`
          : 'Invalid credentials',
        remainingAttempts: lockedUntil ? 0 : MAX_FAILS - fails,
        lockedFor: lockedUntil ? LOCK_MINUTES * 60 : undefined,
      },
      { status: lockedUntil ? 429 : 401 }
    )
  }

  await clearLock(ip)

  await logActivity({
    type: 'ADMIN_LOGIN',
    actor: admin!.username,
    action: 'Logged in',
    details: `Admin logged in from ${ip}`,
    ip,
  })

  return NextResponse.json({
    ok: true,
    token: admin!.passwordHash,
    username: admin!.username,
    isStaff: false,
  })
}
