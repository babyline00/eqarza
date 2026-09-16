'use client'

import { useEffect, useState } from 'react'
import { useAuth, api, uploadFile, validateImageFile, pickFirstImage } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { PLATFORM_CONFIG } from '@/lib/config'
import { PaymentInfoModal } from '@/components/screens/payment-info'
import { Upload, Copy, CheckCircle2, Clock, AlertCircle, X, Info, ArrowRight } from 'lucide-react'

export function DownpaymentScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [loan, setLoan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [showNext, setShowNext] = useState(true)
  const [accounts, setAccounts] = useState<any[]>([])

  const load = () => {
    api('/api/loan/select')
      .then((res) => {
        setLoan(res.loan)
        if (res.loan?.downpaymentProof) setProofImage(res.loan.downpaymentProof)
      })
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
    api('/api/bank-details')
      .then((res) => setAccounts(res.accounts || []))
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toast({ title: 'Copied!', description: 'Account number copied' })
  }

  const handleFile = async (file: File) => {
    if (!file) return
    const errMsg = validateImageFile(file)
    if (errMsg) {
      toast({ title: 'Invalid file', description: errMsg, variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setProofImage(url)
      toast({ title: 'Uploaded!', description: 'Screenshot uploaded successfully' })
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!loan || !proofImage) return
    setSubmitting(true)
    try {
      await api('/api/loan/downpayment', { method: 'POST', body: { loanId: loan.id, proofImage } })
      toast({ title: 'Submitted!', description: 'Your proof is pending admin review.' })
      load() // refresh
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Security Downpayment" onBack={() => setView('withdrawal')} />
        <div className="p-6 text-emerald-600 animate-pulse">Loading...</div>
      </PhoneFrame>
    )
  }

  if (!loan) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Security Downpayment" onBack={() => setView('eligibility')} />
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">No active loan.</p>
        </div>
      </PhoneFrame>
    )
  }

  const downpayment = loan.downpaymentAmount || Math.round(loan.amount * 0.1)
  const downpaymentPct = loan.downpaymentAmount && loan.amount ? Math.round((loan.downpaymentAmount / loan.amount) * 100) : 10

  // Status banner
  const isApproved = loan.downpaymentStatus === 'APPROVED'
  const isRejected = loan.downpaymentStatus === 'REJECTED'
  const isPending = loan.downpaymentStatus === 'PENDING' && loan.downpaymentProof

  return (
    <PhoneFrame showBottomNav={false}>
      <ScreenHeader title="Security Downpayment" onBack={() => setView('withdrawal')} />

      {/* Status banner */}
      {isApproved && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Downpayment Approved!</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your {downpaymentPct}% security has been verified. Now pay your 1st installment to unlock withdrawal.
            </p>
            <Button
              onClick={() => setView('first_installment')}
              className="mt-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Pay 1st Installment →
            </Button>
          </div>
        </div>
      )}

      {isPending && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
          <div>
            <p className="text-sm font-bold text-amber-800">Pending Admin Review</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your downpayment proof has been submitted. Admin will verify it shortly (usually within 1 hour).
            </p>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Downpayment Rejected</p>
            <p className="text-xs text-red-700 mt-0.5">
              Reason: {loan.downpaymentAdminNote || 'Invalid proof'}. Please re-upload a clear screenshot.
            </p>
          </div>
        </div>
      )}

      <div className="p-5 pb-24">
        {/* Amount to pay */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 mb-4 shadow-lg">
          <p className="text-xs text-emerald-100 font-medium">{downpaymentPct}% Security Downpayment</p>
          <p className="text-3xl font-bold mt-1">Rs. {downpayment.toLocaleString()}</p>
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span className="text-emerald-100">Loan Amount:</span>
            <span className="font-semibold">Rs. {loan.amount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-emerald-100">Refundable:</span>
            <span className="font-semibold">Yes, on completion</span>
          </div>
        </div>

        {/* Why downpayment */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-900">
          🔐 <span className="font-semibold">Why {downpaymentPct}% downpayment?</span> This is a security deposit to verify your
          commitment. It will be refunded / adjusted against your final installment when the loan is completed.
        </div>

        {/* Deposit accounts */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Send Rs. {downpayment.toLocaleString()} to any of these accounts:
          </h3>
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 shrink-0 ml-2"
          >
            <Info className="w-3.5 h-3.5" /> Urdu Guide
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {(accounts.length ? accounts : PLATFORM_CONFIG.depositAccounts).map((acc, i) => (
            <div key={i} className="bg-white border-2 border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">{acc.method}</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
              </div>
              <p className="text-[11px] text-slate-500">{acc.accountTitle}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-sm font-mono font-semibold text-slate-800 break-all">{acc.accountNumber}</p>
                <button
                  onClick={() => copy(acc.accountNumber, acc.method)}
                  className="ml-2 p-1.5 rounded-md bg-slate-100 hover:bg-emerald-100 transition-colors shrink-0"
                >
                  {copied === acc.method ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Upload proof */}
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Upload Payment Screenshot</h3>

        {proofImage ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
            <img src={proofImage} alt="Payment proof" loading="lazy" decoding="async" className="w-full h-48 object-cover" />
            {!isApproved && !isPending && (
              <button
                onClick={() => setProofImage(null)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
            <div className="text-center">
              {uploading ? (
                <p className="text-sm text-emerald-600 animate-pulse">Uploading...</p>
              ) : (
                <>
                  <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">Tap to upload screenshot</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">PNG, JPG up to 8MB</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = pickFirstImage(e)
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </label>
        )}

        {proofImage && !isApproved && !isPending && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Screenshot ready. Click submit to send for admin verification.
          </p>
        )}
      </div>

      {/* Submit button */}
      {!isApproved && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe">
          <Button
            onClick={submit}
            disabled={submitting || !proofImage || isPending}
            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
          >
            {submitting
              ? 'Submitting...'
              : isPending
              ? 'Awaiting Admin Review'
              : 'Submit for Verification'}
          </Button>
        </div>
      )}

      <PaymentInfoModal open={showInfo} onClose={() => setShowInfo(false)} />

      {isApproved && showNext && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Downpayment Approved!</h3>
                <p className="text-[11px] text-slate-500">
                  Pay your 1st installment to unlock your loan withdrawal.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-emerald-800">1st Installment: Rs. {loan.weeklyInstallment?.toLocaleString()}</p>
              <p className="text-xs text-emerald-700 mt-1">
                Withdrawal of Rs. {loan.amount?.toLocaleString()} unlocks once verified.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4" dir="rtl">
              <p className="text-sm font-semibold text-amber-800">آپ کی سکیورٹی ڈاؤن پیمنٹ منظور ہو گئی ہے</p>
              <p className="text-xs text-amber-700 mt-0.5">وِتھ ڈرا ل کھولنے کے لیے پہلی قسط ادا کریں</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowNext(false)}
                variant="outline"
                className="flex-1 h-12 rounded-xl font-semibold"
              >
                Later
              </Button>
              <Button
                onClick={() => setView('first_installment')}
                className="flex-[2] h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold"
              >
                Pay 1st Installment <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  )
}
