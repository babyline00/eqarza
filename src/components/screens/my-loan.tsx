'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDownToLine,
  ChevronRight,
  BadgeCheck,
  Landmark,
  Loader2,
} from 'lucide-react'

export function MyLoanScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/loan/select')
      .then((res) => setLoans(res.loans || (res.loan ? [res.loan] : [])))
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PhoneFrame activeTab="loan">
        <ScreenHeader title="My Loan" onBack={() => setView('dashboard')} />
        <div className="p-6 flex items-center justify-center text-emerald-600">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
        </div>
      </PhoneFrame>
    )
  }

  const activeLoan = loans.find((l) => l.status !== 'COMPLETED')
  const history = loans.filter((l) => l.status === 'COMPLETED')

  if (loans.length === 0) {
    return (
      <PhoneFrame activeTab="loan">
        <ScreenHeader title="My Loan" onBack={() => setView('dashboard')} />
        <div className="p-6 text-center py-16">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No loans yet</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            You don&apos;t have any loan right now. Apply for a new loan in one minute.
          </p>
          <Button
            onClick={() => setView('eligibility')}
            className="bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl"
          >
            Apply for a Loan
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  if (!activeLoan) {
    return (
      <PhoneFrame activeTab="loan">
        <ScreenHeader title="My Loan" onBack={() => setView('dashboard')} />
        <div className="p-4 pb-24 space-y-4">
          <HistorySection loans={history} />
          <Button
            onClick={() => setView('eligibility')}
            className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl"
          >
            Apply for a Loan
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  const loan = activeLoan
  const status = loan.status
  const isCompleted = false

  return (
    <PhoneFrame activeTab="loan">
      <ScreenHeader title="My Loan" onBack={() => setView('dashboard')} />

      {/* Loan summary */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-emerald-100">Loan Amount</p>
            <p className="text-3xl font-bold">Rs. {loan.amount.toLocaleString()}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/20 text-xs">
          <div>
            <p className="text-emerald-100 text-[10px]">Weekly Installment</p>
            <p className="font-bold">Rs. {loan.weeklyInstallment.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-emerald-100 text-[10px]">Term</p>
            <p className="font-bold">{loan.totalInstallments} weeks</p>
          </div>
          <div>
            <p className="text-emerald-100 text-[10px]">Downpayment</p>
            <p className="font-bold">Rs. {loan.downpaymentAmount?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-emerald-100 text-[10px]">Interest</p>
            <p className="font-bold">0%</p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-24 space-y-4">
        {/* Next action */}
        {!isCompleted && (
          <ActionCard loan={loan} setView={setView} />
        )}

        {/* Withdrawal details */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" /> Withdrawal
          </h3>
          {loan.withdrawalMethod ? (
            <div className="text-xs space-y-1.5">
              <Row label="Method" value={loan.withdrawalMethod} />
              <Row label="Account" value={`${loan.withdrawalAccountTitle} — ${loan.withdrawalAccountNumber}${loan.withdrawalBank ? ` (${loan.withdrawalBank})` : ''}`} />
              <Row
                label="Status"
                value={
                  loan.withdrawalStatus === 'PAID'
                    ? '✓ Money sent to your account'
                    : loan.withdrawalStatus === 'REJECTED'
                      ? 'Rejected — your downpayment will be refunded'
                      : loan.withdrawalUnlocked
                        ? 'Processing — you will receive the funds shortly'
                        : 'Locked (pay 1st installment)'
                }
              />
              {loan.withdrawalTxnId && <Row label="Transaction ID" value={loan.withdrawalTxnId} />}
              {loan.withdrawalAdminNote && <Row label="Note" value={loan.withdrawalAdminNote} />}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Withdrawal account not set yet.</p>
          )}
        </div>

        {/* Installment schedule */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Installment Schedule</h3>
          {loan.installments?.length > 0 ? (
            <div className="space-y-2">
              {loan.installments.map((inst: any) => (
                <div
                  key={inst.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    inst.status === 'PAID'
                      ? 'bg-emerald-50 border-emerald-200'
                      : inst.proofImage
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        inst.status === 'PAID'
                          ? 'bg-emerald-600 text-white'
                          : inst.proofImage
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {inst.installmentNumber}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Week {inst.installmentNumber}</p>
                      <p className="text-[10px] text-slate-500">
                        Due: {new Date(inst.dueDate).toLocaleDateString('en-PK')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">Rs. {inst.amount.toLocaleString()}</p>
                    <p className="text-[10px] font-medium">
                      {inst.status === 'PAID' ? (
                        <span className="text-emerald-600">✓ Paid</span>
                      ) : inst.proofImage ? (
                        <span className="text-amber-600">⏳ Verifying</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Installments will be generated after your downpayment is approved.
            </p>
          )}
        </div>

        {/* Reward balance */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <BadgeCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-xs text-amber-800">
            Reward credits are applied against your installments automatically. View your reward balance in Profile.
          </div>
        </div>

        {/* Loan history (past completed loans) */}
        {history.length > 0 && <HistorySection loans={history} />}
      </div>
    </PhoneFrame>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string }> = {
    DRAFT: { label: 'Draft', bg: 'bg-slate-400' },
    DOWNPAYMENT_PENDING: { label: 'Downpayment Pending', bg: 'bg-amber-400' },
    DOWNPAYMENT_APPROVED: { label: 'Downpayment Approved', bg: 'bg-emerald-500' },
    FIRST_INSTALLMENT_PENDING: { label: '1st Installment', bg: 'bg-amber-400' },
    ACTIVE: { label: 'Active', bg: 'bg-emerald-500' },
    COMPLETED: { label: 'Completed', bg: 'bg-blue-500' },
    REJECTED: { label: 'Rejected', bg: 'bg-red-500' },
  }
  const cfg = map[status] || map.DRAFT
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg} text-white shrink-0`}>
      {cfg.label}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-semibold text-slate-700 text-right break-all">{value}</span>
    </div>
  )
}

function ActionCard({ loan, setView }: { loan: any; setView: (v: any) => void }) {
  const status = loan.status

  if (status === 'REJECTED') {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
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

  if (status === 'DOWNPAYMENT_PENDING' || status === 'DRAFT') {
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Pay Security Downpayment</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Pay Rs. {loan.downpaymentAmount?.toLocaleString()} ({loan.amount ? Math.round((loan.downpaymentAmount / loan.amount) * 100) : 10}% security) and upload proof.
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

  if (status === 'DOWNPAYMENT_APPROVED' || status === 'FIRST_INSTALLMENT_PENDING') {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Pay 1st Installment to Unlock</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Pay Rs. {loan.weeklyInstallment?.toLocaleString()} to unlock withdrawal of Rs.{' '}
              {loan.amount?.toLocaleString()}.
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

  if (status === 'ACTIVE' && loan.withdrawalUnlocked && !loan.withdrawnAt) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Landmark className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Withdrawal Processing</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your loan of Rs. {loan.amount?.toLocaleString()} is being transferred to your registered account
              (within 24 hours).
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'ACTIVE') {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Loan Active</p>
            <p className="text-xs text-emerald-700 mt-0.5">Keep paying your weekly installments on time.</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function HistorySection({ loans }: { loans: any[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Loan History
      </h3>
      <div className="space-y-3">
        {loans.map((l) => {
          const paid = (l.installments || []).filter((i: any) => i.status === 'PAID').length
          const total = l.installments?.length || l.totalInstallments || 0
          return (
            <div key={l.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-bold text-slate-800">
                  Rs. {l.amount?.toLocaleString()}
                  <span className="text-[10px] font-medium text-slate-500 ml-2">
                    {l.termDays || 30} days
                  </span>
                </p>
                <StatusBadge status={l.status} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Applied {new Date(l.createdAt).toLocaleDateString('en-PK')}
                </span>
                <span className="text-emerald-700 font-semibold">
                  {paid} of {total} installments paid
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        All paid loans shown above. A new loan can be applied once the current loan is completed.
      </p>
    </div>
  )
}