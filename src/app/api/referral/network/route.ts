import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

const TREE_DEPTH = 4
const TREE_MAX_NODES = 200

type Node = {
  userId: string
  name: string | null
  phone: string
  confirmedLoans: number
  activeLoan: boolean
  children: Node[]
}

// GET /api/referral/network
// Returns the authenticated user's personal invite link plus their full referral
// tree (everyone who signed up through their code, recursively) and their own referrer.
export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inviteUrl = `${req.nextUrl.origin}/?ref=${user.referralCode}`

  const allUsers = await db.user.findMany({
    where: { deleted: false, blocked: false, referralCode: { not: null } },
    select: {
      id: true,
      name: true,
      phone: true,
      referralCode: true,
      referredBy: true,
      loans: { select: { status: true } },
    },
  })

  const byCode = new Map<string, (typeof allUsers)[number]>()
  for (const u of allUsers) if (u.referralCode) byCode.set(u.referralCode, u)

  const stats = {
    total: 0,
    active: 0,
    confirmedLoans: 0,
  }

  let expanded = 0
  const buildTree = (refCode: string | null, depth: number): Node[] => {
    if (!refCode || depth > TREE_DEPTH || expanded >= TREE_MAX_NODES) return []
    const nodes: Node[] = []
    for (const u of allUsers) {
      if (u.referredBy !== refCode) continue
      expanded++
      stats.total++
      const confirmedLoans = u.loans.filter((l) => l.status === 'COMPLETED').length
      const activeLoan = u.loans.some((l) => ['ACTIVE', 'DOWNPAYMENT_PENDING', 'DOWNPAYMENT_APPROVED', 'FIRST_INSTALLMENT_PENDING'].includes(l.status))
      if (activeLoan) stats.active++
      if (confirmedLoans > 0) stats.confirmedLoans += confirmedLoans
      nodes.push({
        userId: u.id,
        name: u.name,
        phone: u.phone,
        confirmedLoans,
        activeLoan,
        children: buildTree(u.referralCode, depth + 1),
      })
    }
    return nodes
  }

  const tree = buildTree(user.referralCode, 1)

  // Who referred this user (single level up — the immediately inviting person).
  let myReferrer: { userId: string; name: string | null; phone: string } | null = null
  if (user.referredBy) {
    const ref = byCode.get(user.referredBy)
    if (ref && ref.id !== user.id) {
      myReferrer = { userId: ref.id, name: ref.name, phone: ref.phone }
    }
  }

  // Resolve one level of grandparent names for the tree display, if desired.
  return NextResponse.json({
    referralCode: user.referralCode,
    inviteUrl,
    myReferrer,
    stats,
    tree,
  })
}
