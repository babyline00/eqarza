'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Phone,
  Gift,
  Copy,
  Link2,
  Users,
  BadgeCheck,
  LogOut,
  ChevronRight,
  Award,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowUpRight,
} from 'lucide-react'

type NetNode = {
  userId: string
  name: string | null
  phone: string
  confirmedLoans: number
  activeLoan: boolean
  children: NetNode[]
}

export function ProfileScreen() {
  const { setView, logout, phone } = useAuth()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [net, setNet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const load = () => {
    Promise.all([api('/api/user/me'), api('/api/referral/network')])
      .then(([u, n]) => {
        setUser(u)
        setNet(n)
      })
      .catch((e) => {
        if (String(e.message).includes('Unauthorized')) {
          logout()
        } else {
          toast({ title: 'Error', description: e.message, variant: 'destructive' })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const copy = (text: string, which: 'code' | 'link') => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(which)
        setTimeout(() => setCopied(null), 2000)
        toast({ title: 'Copied!', description: which === 'code' ? 'Referral code copied' : 'Invite link copied' })
      },
      () => toast({ title: 'Copy failed', description: 'Could not copy, please copy manually', variant: 'destructive' })
    )
  }

  if (loading) {
    return (
      <PhoneFrame activeTab="profile">
        <ScreenHeader title="Profile" onBack={() => setView('dashboard')} />
        <div className="p-6 flex items-center justify-center text-emerald-600">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
        </div>
      </PhoneFrame>
    )
  }

  const kyc = user?.kyc
  const referralCode = user?.referralCode || net?.referralCode || ''
  const inviteUrl = net?.inviteUrl || (typeof window !== 'undefined' ? `${window.location.origin}/?ref=${referralCode}` : '')

  return (
    <PhoneFrame activeTab="profile">
      <ScreenHeader title="Profile" onBack={() => setView('dashboard')} />

      <div className="p-4 pb-24 space-y-4">
        {/* Identity card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
              {(kyc?.fullName?.[0] || user?.name?.[0] || phone?.[3] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{kyc?.fullName || user?.name || 'E-Qarza User'}</h2>
              <p className="text-sm text-emerald-100 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {phone}
              </p>
              <p className="text-[11px] text-emerald-100 mt-0.5 flex items-center gap-1">
                {kyc ? (
                  kyc.kycStatus === 'APPROVED' ? (
                    <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-amber-300" /> KYC Verified</span>
                  ) : kyc.kycStatus === 'REJECTED' ? (
                    <span className="flex items-center gap-1 text-amber-300"><Clock className="w-3.5 h-3.5" /> KYC Rejected</span>
                  ) : (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> KYC Under Review</span>
                  )
                ) : (
                  <span>KYC not completed</span>
                )}
              </p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 w-9 h-9 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-100">Reward Balance</p>
              <p className="text-xl font-bold">Rs. {user?.rewardBalance?.toLocaleString() || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-100">Referrals</p>
              <p className="text-xl font-bold">{net?.stats?.total || 0}</p>
            </div>
          </div>
        </div>

        {/* Referral card */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">Refer & Earn</h3>
            <span className="ml-auto text-[11px] font-bold text-emerald-700">Rs. {user?.referralBonus?.toLocaleString() ?? 200} / referral</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[9px] text-amber-600 font-semibold">YOUR REFERRAL CODE</p>
              <p className="text-sm font-mono font-bold tracking-wider text-amber-800">{referralCode || '—'}</p>
            </div>
            <button
              onClick={() => referralCode && copy(referralCode, 'code')}
              disabled={!referralCode}
              className="px-3 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1 text-xs font-bold disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> {copied === 'code' ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-[11px] text-slate-600 flex-1 truncate">{inviteUrl || '—'}</p>
            <button
              onClick={() => inviteUrl && copy(inviteUrl, 'link')}
              disabled={!inviteUrl}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center gap-1 text-[11px] font-bold disabled:opacity-50"
            >
              <Copy className="w-3 h-3" /> {copied === 'link' ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          <p className="text-[10px] text-amber-700 mt-2">
            Share your link — when a friend signs up with it and confirms a loan, you earn a Rs. {user?.referralBonus?.toLocaleString() ?? 200} reward credited to
            your balance automatically.
          </p>
        </div>

        {/* Referral tree */}
        <ReferralTree
          myReferrer={net?.myReferrer}
          tree={net?.tree || []}
          stats={net?.stats}
        />

        {/* Personal details */}
        {kyc && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-800">Personal Details</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              <Row label="Full Name" value={kyc.fullName} />
              <Row label="Phone" value={phone || ''} />
              <Row label="CNIC" value={kyc.cnic} />
              <Row label="Date of Birth" value={kyc.dob || '—'} />
              <Row label="Occupation" value={kyc.occupation || '—'} />
              <Row label="Monthly Income" value={`Rs. ${kyc.monthlyIncome?.toLocaleString() || 0}`} />
              <Row label="City" value={kyc.city || '—'} />
              <Row label="Email" value={kyc.email || '—'} />
            </div>
          </div>
        )}

        <Button
          onClick={() => setView('dashboard')}
          variant="outline"
          className="w-full border-emerald-300 text-emerald-700 font-bold rounded-xl"
        >
          Back to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </PhoneFrame>
  )
}

function ReferralTree({ myReferrer, tree, stats }: { myReferrer: any; tree: NetNode[]; stats?: any }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true })
  const [collapsed, setCollapsed] = useState(false)

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }))

  const totalNodes = countNodes(tree)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-800">My Referral Network</h3>
        {totalNodes > 0 && (
          <button onClick={() => setCollapsed((c) => !c)} className="ml-auto text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />} {collapsed ? 'Expand' : 'Collapse'}
          </button>
        )}
      </div>

      {myReferrer && (
        <div className="mt-2 mb-1 flex items-center gap-2">
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <p className="text-[11px] text-slate-500">
            Referred by <span className="font-semibold text-slate-700">{myReferrer.name || myReferrer.phone}</span>
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-2 mb-3 text-center">
        <StatBox label="Total" value={stats?.total ?? totalNodes} icon={<Users className="w-3.5 h-3.5 text-emerald-600" />} />
        <StatBox label="Active" value={stats?.active ?? 0} icon={<Award className="w-3.5 h-3.5 text-amber-600" />} />
        <StatBox label="Loans Confirmed" value={stats?.confirmedLoans ?? 0} icon={<BadgeCheck className="w-3.5 h-3.5 text-blue-600" />} />
      </div>

      {totalNodes === 0 && (
        <p className="text-xs text-slate-500 mt-1">
          No referrals yet. Share your code or invite link above to grow your network and earn rewards.
        </p>
      )}

      {!collapsed && totalNodes > 0 && (
        <TreeBranch
          root
          referralCode="YOU"
          name={null}
          open={expanded.root}
          onToggle={() => toggle('root')}
          expanded={expanded}
          onToggleNode={toggle}
          nodes={tree}
        />
      )}
    </div>
  )
}

function TreeBranch({
  root,
  referralCode,
  name,
  activeLoan,
  confirmedLoans,
  open,
  onToggle,
  nodes,
  expanded,
  onToggleNode,
}: {
  root?: boolean
  referralCode?: string
  name?: string | null
  activeLoan?: boolean
  confirmedLoans?: number
  open: boolean
  onToggle: () => void
  nodes: NetNode[]
  expanded: Record<string, boolean>
  onToggleNode: (id: string) => void
}) {
  const hasChildren = nodes.length > 0
  return (
    <div className={root ? undefined : 'ml-4 border-l-2 border-emerald-100 pl-3'}>
      <div className="flex items-center gap-2 py-1">
        {hasChildren ? (
          <button onClick={onToggle} className="w-5 h-5 shrink-0 flex items-center justify-center text-emerald-600">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        )}
        <div
          className={`flex-1 rounded-lg border px-2.5 py-1.5 ${
            root
              ? 'border-emerald-400 bg-emerald-600 text-white'
              : activeLoan
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <p className="text-xs font-semibold truncate">{root ? 'You' : (name || 'Referral')}</p>
          <p className={`text-[10px] ${root ? 'text-emerald-100' : 'text-slate-500'}`}>
            {root ? `Referral code: ${referralCode}` : activeLoan ? 'Active loan' : 'Signed up'}
            {confirmedLoans ? ` · ${confirmedLoans} completed` : null}
          </p>
        </div>
      </div>

      {open &&
        nodes.map((c) => (
          <TreeBranch
            key={c.userId}
            name={c.name || c.phone}
            activeLoan={c.activeLoan}
            confirmedLoans={c.confirmedLoans}
            open={!!expanded[c.userId]}
            onToggle={() => onToggleNode(c.userId)}
            expanded={expanded}
            onToggleNode={onToggleNode}
            nodes={c.children}
          />
        ))}
    </div>
  )
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex-1 bg-slate-50 rounded-lg py-2 px-1 flex flex-col items-center">
      <div className="flex items-center gap-1">{icon}<span className="text-base font-bold text-slate-800">{value}</span></div>
      <span className="text-[9px] text-slate-500">{label}</span>
    </div>
  )
}

function countNodes(tree: NetNode[]): number {
  let n = 0
  const walk = (nodes: NetNode[]) => {
    for (const t of nodes) {
      n++
      if (t.children.length) walk(t.children)
    }
  }
  walk(tree)
  return n
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-semibold text-slate-700 text-right break-all">{value}</span>
    </div>
  )
}
