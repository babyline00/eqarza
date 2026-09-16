'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { KycScanCard, KycStatusList } from '@/components/kyc-card'
import { playNotificationSound } from '@/lib/notification-sound'
import { tr } from '@/lib/i18n'
import {
  Wallet,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
  Plus,
  User,
  Phone,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Copy,
  Gift,
} from 'lucide-react'

export function DashboardScreen() {
  const { setView, logout, phone, lang } = useAuth()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notifCount, setNotifCount] = useState(0)
  // Last-seen KYC status (undefined until the first load) — used to detect
  // live status changes made by the admin on the KYC Review screen
  const kycStatusRef = useRef<string | null | undefined>(undefined)

  const applyUserData = (u: any, n: any) => {
    const prev = kycStatusRef.current
    const next = u?.kyc?.kycStatus || null
    setUser(u)
    setNotifCount(n?.notifications?.filter((x: any) => !x.read).length || 0)

    // Fire a live alert only for transitions the user did NOT cause themselves
    if (prev !== undefined && next !== prev) {
      if (next === 'APPROVED') {
        playNotificationSound('loan')
        toast({ title: 'KYC Approved! 🎉', description: 'Your identity has been verified. You can now apply for a loan.' })
      } else if (next === 'REJECTED') {
        playNotificationSound('other')
        toast({
          title: 'KYC Rejected',
          description: u?.kyc?.kycAdminNote || 'Please re-upload clear documents.',
          variant: 'destructive',
        })
      } else if (next === null && prev) {
        playNotificationSound('other')
        toast({ title: 'KYC case removed', description: 'Your submission was removed by our team. Please submit your documents again.' })
      } else if (next === 'PENDING' && (prev === 'APPROVED' || prev === 'REJECTED')) {
        playNotificationSound('other')
        toast({ title: 'KYC updated by our team', description: 'Your verification status was changed. Please check the details below.' })
      }
    }
    kycStatusRef.current = next
  }

  const load = () => {
    Promise.all([api('/api/user/me'), api('/api/notifications')])
      .then(([u, n]) => applyUserData(u, n))
      .catch((e) => {
        // If unauthorized, go back to login
        if (e.message.includes('Unauthorized')) {
          logout()
        } else {
          toast({ title: 'Error', description: e.message, variant: 'destructive' })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Live auto-refresh: keeps the user screen in sync with admin actions
  // (KYC approval / rejection / case removal) without any manual refresh.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return // save requests while the tab is in background
      Promise.all([api('/api/user/me'), api('/api/notifications')])
        .then(([u, n]) => applyUserData(u, n))
        .catch(() => {
          // silent — transient poll failures must not spam the user
        })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <PhoneFrame>
        <div className="p-6 text-emerald-600 animate-pulse">Loading...</div>
      </PhoneFrame>
    )
  }

  // Determine which screen to show based on user state
  const kyc = user?.kyc
  const kycApproved = kyc?.kycStatus === 'APPROVED'
  const activeLoan = user?.loans?.[0]

  // No KYC -> prompt to start
  if (!kyc) {
    return (
      <PhoneFrame activeTab="home">
        <div className="p-6">
          <Header phone={phone} name={user?.name || phone} onLogout={logout} onBell={() => setView('notifications')} notifCount={notifCount} />
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 mt-4 shadow-lg">
            <ShieldCheck className="w-10 h-10 text-amber-400 mb-2" />
            <h2 className="text-xl font-bold mb-1">{tr(lang, 'dashboard_welcome')}</h2>
            <p className="text-sm text-emerald-100 mb-4">
              {tr(lang, 'dashboard_kyc_prompt')}
            </p>
            <Button
              onClick={() => setView('kyc')}
              className="w-full h-12 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl"
            >
              {tr(lang, 'start_kyc')}
            </Button>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // Has KYC but no loan
  if (!activeLoan) {
    const kycPending = kyc.kycStatus === 'PENDING' || !kyc.kycStatus
    const kycRejected = kyc.kycStatus === 'REJECTED'
    return (
      <PhoneFrame activeTab="home">
        <div className="p-5">
          <Header phone={phone} name={user?.name || phone} onLogout={logout} onBell={() => setView('notifications')} notifCount={notifCount} />

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 mt-4 shadow-lg">
            <p className="text-xs text-emerald-100">{tr(lang, 'dashboard_hello')}</p>
            <h2 className="text-xl font-bold">{kyc.fullName.split(' ')[0]} 👋</h2>
            <p className="text-sm text-emerald-100 mt-1">
              {kycApproved
                ? tr(lang, 'kyc_verified_ok')
                : kycRejected
                ? tr(lang, 'kyc_attention')
                : tr(lang, 'kyc_review')}
            </p>
          </div>

          {kycPending && (
            <>
              <div className="mt-4">
                <KycScanCard cnic={kyc.cnic} frontImage={kyc.cnicFrontImage} />
              </div>

              <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">{tr(lang, 'verification_status')}</p>
                <KycStatusList />
              </div>

              <div className="mt-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">{tr(lang, 'kyc_under_review')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {tr(lang, 'kyc_under_review_desc')}
                  </p>
                </div>
              </div>
            </>
          )}

          {kycRejected && (
            <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">{tr(lang, 'kyc_rejected')}</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {kyc.kycAdminNote || tr(lang, 'kyc_rejected_desc')}
                </p>
                <Button
                  onClick={() => setView('kyc')}
                  className="mt-2 h-9 bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
                >
                  {tr(lang, 'reupload_docs')}
                </Button>
              </div>
            </div>
          )}

          {kycApproved && (
            <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{tr(lang, 'your_loan_limit')}</p>
                  <p className="text-lg font-bold text-emerald-700">Based on income Rs. {kyc.monthlyIncome.toLocaleString()}</p>
                </div>
              </div>
              <Button
                onClick={() => setView('eligibility')}
                className="w-full h-12 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1" /> {tr(lang, 'apply_loan')}
              </Button>
            </div>
          )}

          {/* Profile summary */}
          <ProfileCard kyc={kyc} user={user} />
        </div>
      </PhoneFrame>
    )
  }

  // Has a loan — show loan status
  const status = activeLoan.status
  const isWithdrawn = activeLoan.withdrawalUnlocked
  const isCompleted = status === 'COMPLETED'

  return (
    <PhoneFrame activeTab="home">
      <div className="p-5">
        <Header phone={phone} name={user?.name || phone} onLogout={logout} onBell={() => setView('notifications')} notifCount={notifCount} />

        {/* Loan Card */}
        <button
          onClick={() => setView('my_loan')}
          className="w-full text-left bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 mt-4 shadow-lg relative overflow-hidden hover:opacity-95 transition-opacity"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl" />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-emerald-100">Loan Amount</p>
              <p className="text-3xl font-bold">Rs. {activeLoan.amount.toLocaleString()}</p>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-[10px] text-emerald-100">Weekly Installment</p>
              <p className="text-sm font-bold">Rs. {activeLoan.weeklyInstallment.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-100">Total Installments</p>
              <p className="text-sm font-bold">{activeLoan.totalInstallments} (Weekly)</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-100">Withdrawal Method</p>
              <p className="text-sm font-bold">{activeLoan.withdrawalMethod || 'Not set'}</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-100">Downpayment</p>
              <p className="text-sm font-bold">Rs. {activeLoan.downpaymentAmount?.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-end text-xs text-amber-300 font-semibold">
            View full details <ChevronRight className="w-3 h-3 ml-0.5" />
          </div>
        </button>

        {/* Action card */}
        <ActionCard loan={activeLoan} setView={setView} />

        {/* Installment Progress */}
        {activeLoan.installments && activeLoan.installments.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Installment Progress</h3>
            <div className="space-y-2">
              {activeLoan.installments.map((inst: any) => (
                <div
                  key={inst.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                    inst.status === 'PAID' ? 'bg-emerald-50' : inst.proofImage ? 'bg-amber-50' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        inst.status === 'PAID'
                          ? 'bg-emerald-600 text-white'
                          : inst.proofImage
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-300 text-slate-600'
                      }`}
                    >
                      {inst.installmentNumber}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Week {inst.installmentNumber}</p>
                      <p className="text-[10px] text-slate-500">Due: {new Date(inst.dueDate).toLocaleDateString('en-PK')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">Rs. {inst.amount.toLocaleString()}</p>
                    <p className="text-[10px]">
                      {inst.status === 'PAID' ? (
                        <span className="text-emerald-600 font-medium">✓ Paid</span>
                      ) : inst.proofImage ? (
                        <span className="text-amber-600 font-medium">⏳ Verifying</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Withdrawal section if unlocked */}
        {isWithdrawn && !isCompleted && (
          <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownToLine className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-800">Withdrawal Available!</h3>
            </div>
            <p className="text-xs text-amber-700 mb-3">
              Your loan amount of Rs. {activeLoan.amount.toLocaleString()} is ready to be sent to:
            </p>
            <div className="bg-white rounded-lg p-2.5 text-xs">
              <p className="font-semibold text-slate-800">{activeLoan.withdrawalMethod}</p>
              <p className="text-slate-600">
                {activeLoan.withdrawalAccountTitle} — {activeLoan.withdrawalAccountNumber}
                {activeLoan.withdrawalBank ? ` (${activeLoan.withdrawalBank})` : ''}
              </p>
            </div>
            <p className="text-[10px] text-amber-600 mt-2">
              💡 Funds will be transferred within 24 hours of approval to your registered account.
            </p>
          </div>
        )}

        {/* Profile */}
        <ProfileCard kyc={kyc} user={user} />
      </div>
    </PhoneFrame>
  )
}

function Header({
  phone,
  name,
  onLogout,
  onBell,
  notifCount,
}: {
  phone: string | null
  name: string | null
  onLogout: () => void
  onBell: () => void
  notifCount: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
          {name?.[0]?.toUpperCase() || phone?.[4] || 'U'}
        </div>
        <div>
          <p className="text-xs text-slate-500">Welcome back</p>
          <p className="text-sm font-bold text-slate-800">{name || phone}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onBell}
          className="relative w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-emerald-50"
        >
          <Bell className="w-4 h-4 text-slate-600" />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {notifCount}
            </span>
          )}
        </button>
        <button
          onClick={onLogout}
          className="w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-red-50 hover:border-red-200"
        >
          <LogOut className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    DRAFT: { label: 'Draft', bg: 'bg-slate-400', text: 'text-white' },
    DOWNPAYMENT_PENDING: { label: 'Downpayment Pending', bg: 'bg-amber-400', text: 'text-white' },
    DOWNPAYMENT_APPROVED: { label: 'Downpayment Approved', bg: 'bg-emerald-500', text: 'text-white' },
    FIRST_INSTALLMENT_PENDING: { label: '1st Installment', bg: 'bg-amber-400', text: 'text-white' },
    ACTIVE: { label: 'Active', bg: 'bg-emerald-500', text: 'text-white' },
    COMPLETED: { label: 'Completed', bg: 'bg-blue-500', text: 'text-white' },
    REJECTED: { label: 'Rejected', bg: 'bg-red-500', text: 'text-white' },
  }
  const cfg = map[status] || map.DRAFT
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function ActionCard({ loan, setView }: { loan: any; setView: (v: any) => void }) {
  const status = loan.status

  if (status === 'DOWNPAYMENT_PENDING' || status === 'DRAFT') {
    return (
      <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Action Required: Security Downpayment</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Pay Rs. {loan.downpaymentAmount?.toLocaleString()} ({loan.amount ? Math.round((loan.downpaymentAmount / loan.amount) * 100) : 10}% security) and upload proof to continue.
            </p>
            <Button
              onClick={() => setView('downpayment')}
              className="mt-2 h-9 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
            >
              Pay Downpayment <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'FIRST_INSTALLMENT_PENDING') {
    return (
      <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Pay 1st Installment to Unlock Withdrawal</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your downpayment is approved. Now pay Rs. {loan.weeklyInstallment.toLocaleString()} (Week 1) to unlock withdrawal of Rs. {loan.amount.toLocaleString()}.
            </p>
            <Button
              onClick={() => setView('first_installment')}
              className="mt-2 h-9 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
            >
              Pay 1st Installment <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'REJECTED') {
    return (
      <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Downpayment Rejected</p>
            <p className="text-xs text-red-700 mt-0.5">
              {loan.downpaymentAdminNote || 'Your proof was rejected. Please re-upload.'}
            </p>
            <Button
              onClick={() => setView('downpayment')}
              className="mt-2 h-9 bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
            >
              Re-upload Proof <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'COMPLETED') {
    return (
      <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-bold text-emerald-800">Loan Completed! 🎉</p>
        <p className="text-xs text-emerald-700 mt-1">
          You&apos;ve successfully repaid your loan. Apply for a higher amount next time.
        </p>
        <Button
          onClick={() => setView('eligibility')}
          className="mt-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
        >
          Apply for New Loan
        </Button>
      </div>
    )
  }

  return null
}

function ProfileCard({ kyc, user }: { kyc: any; user?: any }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copyReferral = () => {
    if (!user?.referralCode) return
    navigator.clipboard.writeText(user.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Copied!', description: 'Referral code copied — share it to earn rewards' })
  }

  return (
    <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-800">Profile</h3>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row label="Full Name" value={kyc.fullName} />
        <Row label="CNIC" value={kyc.cnic} />
        <Row label="Occupation" value={kyc.occupation} />
        <Row label="Monthly Income" value={`Rs. ${kyc.monthlyIncome.toLocaleString()}`} />
        <Row label="City" value={kyc.city} />
      </div>

      {user?.referralCode && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Gift className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-slate-800">Refer & Earn</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex-1">
              <p className="text-[9px] text-amber-600 font-semibold">YOUR REFERRAL CODE</p>
              <p className="text-sm font-mono font-bold tracking-wider text-amber-800">{user.referralCode}</p>
            </div>
            <button
              onClick={copyReferral}
              className="px-3 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1 text-xs font-bold"
            >
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Share your code — when your friend confirms a loan you earn{' '}
            <span className="font-bold text-emerald-700">Rs. {user.referralBonus?.toLocaleString() ?? 200} reward</span>.
          </p>
          {user.rewardBalance > 0 && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">Reward Balance</span>
              <span className="text-sm font-bold text-emerald-700">Rs. {user.rewardBalance.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  )
}
