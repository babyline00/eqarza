'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { KycScanCard } from '@/components/kyc-card'
import { Check, Wallet, Calendar, TrendingUp, Award } from 'lucide-react'

interface EligibilityOption {
  amount: number
  weeklyInstallment: number
  weeks: number
  totalRepayable: number
  downpayment?: number
  downpaymentPct?: number
}

export function EligibilityScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [options, setOptions] = useState<EligibilityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [occupation, setOccupation] = useState('')
  const [referral, setReferral] = useState('')

  // KYC under-review state
  const [kycStatus, setKycStatus] = useState('')
  const [kycCnic, setKycCnic] = useState('')
  const [kycFront, setKycFront] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api('/api/loan/eligibility'), api('/api/user/me')])
      .then(([res, me]) => {
        setOptions(res.eligible || [])
        setMonthlyIncome(res.monthlyIncome || 0)
        setOccupation(res.occupation || '')
        const k = me?.kyc
        setKycStatus(k?.kycStatus || '')
        if (k) {
          setKycCnic(k.cnic || '')
          setKycFront(k.cnicFrontImage || null)
        }
      })
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  const underReview = kycStatus === 'PENDING'

  const selectLoan = async () => {
    if (selected === null) return
    setSubmitting(true)
    try {
      await api('/api/loan/select', {
        method: 'POST',
        body: { amount: selected, referredCode: referral.trim() || undefined },
      })
      toast({ title: 'Loan Selected!', description: 'Now set up your withdrawal account.' })
      setView('withdrawal')
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Loan Offers" onBack={() => setView('dashboard')} />
        <div className="p-6 flex items-center justify-center">
          <div className="text-emerald-600 animate-pulse">Loading offers...</div>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame showBottomNav={false}>
      <ScreenHeader title="Loan Offers" onBack={() => setView('dashboard')} />

      {underReview ? (
        <div className="px-6 pt-[38px]">
          <KycScanCard cnic={kycCnic} frontImage={kycFront} />
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-5 py-5">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-amber-400" />
              <p className="text-sm font-medium text-amber-300">Congratulations! You&apos;re pre-qualified</p>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {options.length > 0 ? `Up to Rs. ${options[options.length - 1].amount.toLocaleString()}` : 'No offers'}
            </h2>
            <p className="text-xs text-emerald-100">
              Based on your {occupation.toLowerCase()} with monthly income of Rs. {monthlyIncome.toLocaleString()}
            </p>
          </div>

          <div className="p-4 pb-24">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900">
              🎯 <span className="font-semibold">How it works:</span> Select a loan amount → Set withdrawal account → Pay security
              downpayment → Pay 1st installment → Withdraw loan!
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Your Loan Amount</h3>

            <div className="space-y-3">
              {options.map((opt) => {
                const isSelected = selected === opt.amount
                return (
                  <button
                    key={opt.amount}
                    onClick={() => setSelected(opt.amount)}
                    className={`w-full text-left border-2 rounded-2xl p-4 transition-all relative ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Loan Amount</p>
                        <p className="text-2xl font-bold text-emerald-700">Rs. {opt.amount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium">Weekly</p>
                        <p className="text-lg font-bold text-slate-800">Rs. {opt.weeklyInstallment.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Stat icon={<Calendar className="w-3 h-3" />} label="Term" value={`${opt.weeks} weeks`} />
                      <Stat icon={<Wallet className="w-3 h-3" />} label="Installments" value={`${opt.weeks} weekly`} />
                      <Stat icon={<TrendingUp className="w-3 h-3" />} label="Interest" value="0%" />
                    </div>
                    <div className="mt-3 bg-slate-50 rounded-lg p-2 text-xs text-slate-600">
                      <span className="font-semibold">{opt.downpaymentPct ?? 10}% Security Downpayment:</span> Rs.{' '}
                      {(opt.downpayment ?? Math.round(opt.amount * 0.1)).toLocaleString()} (refundable)
                    </div>
                  </button>
                )
              })}

              {options.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No eligible offers at this time.</p>
                  {kycStatus === 'REJECTED' ? (
                    <>
                      <p className="text-xs mt-1">Your KYC was rejected. Please re-upload your documents.</p>
                      <Button onClick={() => setView('kyc')} className="mt-4 bg-emerald-600 text-white">
                        Re-upload KYC
                      </Button>
                    </>
                  ) : kycStatus === 'APPROVED' ? (
                    <p className="text-xs mt-1">
                      Your KYC is verified, but no loan amount matches your profile right now.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs mt-1">Please complete your KYC to see loan offers.</p>
                      <Button onClick={() => setView('kyc')} className="mt-4 bg-emerald-600 text-white">
                        Complete KYC
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Referral code */}
            <div className="mt-5 bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-semibold text-slate-800">Have a referral code?</p>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Enter the code shared by a friend to earn rewards (both of you get cash rewards).
              </p>
              <input
                value={referral}
                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                placeholder="e.g. EQZ1234AB"
                maxLength={16}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          </div>

          {selected !== null && (
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe">
              <Button
                onClick={selectLoan}
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
              >
                {submitting ? 'Processing...' : `Continue with Rs. ${selected.toLocaleString()}`}
              </Button>
            </div>
          )}
        </>
      )}
    </PhoneFrame>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-slate-400 mb-0.5">{icon}</div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  )
}