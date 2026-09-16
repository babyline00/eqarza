'use client'

import { useEffect, useState } from 'react'
import { useAuth, api, uploadFile, validateImageFile, pickFirstImage } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { PLATFORM_CONFIG } from '@/lib/config'
import { PaymentInfoModal } from '@/components/screens/payment-info'
import { Upload, Copy, CheckCircle2, Clock, X, Wallet, Lock, ArrowDownToLine, Info } from 'lucide-react'

export function FirstInstallmentScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [loan, setLoan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [accounts, setAccounts] = useState<any[]>([])

  const load = () => {
    api('/api/loan/installment?loanId=' + (loan?.id || ''))
      .then((res) => setLoan(res.loan))
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  const loadLoan = async () => {
    try {
      const res = await api('/api/loan/select')
      if (res.loan) {
        const r2 = await api('/api/loan/installment?loanId=' + res.loan.id)
        setLoan(r2.loan)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api('/api/loan/select')
      .then((res) => {
        if (res.loan) {
          return api('/api/loan/installment?loanId=' + res.loan.id).then((r2) => setLoan(r2.loan))
        }
        return undefined
      })
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
    api('/api/bank-details')
      .then((res) => setAccounts(res.accounts || []))
      .catch(() => {})
  }, [])

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
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
      toast({ title: 'Uploaded!', description: 'Screenshot uploaded' })
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!loan) return
    const firstInst = loan.installments?.find((i: any) => i.installmentNumber === 1)
    if (!firstInst) return
    if (!proofImage && !firstInst.proofImage) {
      toast({ title: 'Upload proof', description: 'Please upload payment screenshot', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await api('/api/loan/installment', {
        method: 'POST',
        body: {
          loanId: loan.id,
          installmentId: firstInst.id,
          proofImage: proofImage || firstInst.proofImage,
        },
      })
      toast({ title: 'Submitted!', description: '1st installment proof sent for verification.' })
      loadLoan()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="1st Installment" onBack={() => setView('downpayment')} />
        <div className="p-6 text-emerald-600 animate-pulse">Loading...</div>
      </PhoneFrame>
    )
  }

  if (!loan) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="1st Installment" onBack={() => setView('dashboard')} />
        <div className="p-6 text-center text-slate-500 text-sm">No active loan.</div>
      </PhoneFrame>
    )
  }

  const firstInst = loan.installments?.find((i: any) => i.installmentNumber === 1)
  if (!firstInst) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="1st Installment" onBack={() => setView('dashboard')} />
        <div className="p-6 text-center text-slate-500 text-sm">Installments not yet generated. Please wait for admin to approve your downpayment.</div>
      </PhoneFrame>
    )
  }

  const isPaid = firstInst.status === 'PAID'
  const isPending = firstInst.proofImage && firstInst.status !== 'PAID'

  return (
    <PhoneFrame showBottomNav={false}>
      <ScreenHeader title="1st Installment — Unlock Withdrawal" onBack={() => setView('downpayment')} />

      {/* Status */}
      {loan.withdrawalUnlocked && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Withdrawal Unlocked!</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your 1st installment is confirmed. You can now withdraw your loan amount.
            </p>
            <Button
              onClick={() => setView('dashboard')}
              className="mt-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Go to Dashboard →
            </Button>
          </div>
        </div>
      )}

      {!loan.withdrawalUnlocked && isPending && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
          <div>
            <p className="text-sm font-bold text-amber-800">Pending Verification</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your 1st installment proof is being verified by admin. Usually takes 1 hour.
            </p>
          </div>
        </div>
      )}

      <div className="p-5 pb-24">
        {/* Amount */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-5 mb-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-100" />
            <p className="text-xs text-amber-100 font-medium">Pay 1st Installment to Unlock</p>
          </div>
          <p className="text-3xl font-bold mt-1">Rs. {firstInst.amount.toLocaleString()}</p>
          <p className="text-xs text-amber-100 mt-2">
            Week 1 of {loan.totalInstallments}. Once paid & verified, your withdrawal of Rs.{' '}
            {loan.amount.toLocaleString()} will be unlocked.
          </p>
        </div>

        {/* Withdrawal preview */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">After verification, withdraw to:</p>
          </div>
          <p className="text-sm font-bold text-slate-800">{loan.withdrawalMethod}</p>
          <p className="text-xs text-slate-600">
            {loan.withdrawalAccountTitle} — {loan.withdrawalAccountNumber}
            {loan.withdrawalBank ? ` (${loan.withdrawalBank})` : ''}
          </p>
        </div>

        {/* Deposit accounts */}
        {!isPaid && !isPending && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Send Rs. {firstInst.amount.toLocaleString()} to:
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
                      className="ml-2 p-1.5 rounded-md bg-slate-100 hover:bg-emerald-100 shrink-0"
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

            {/* Upload */}
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Upload Payment Screenshot</h3>
            {proofImage || firstInst.proofImage ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
                <img src={proofImage || firstInst.proofImage} alt="Payment proof" loading="lazy" decoding="async" className="w-full h-48 object-cover" />
                {proofImage && (
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
                      <p className="text-xs font-semibold text-slate-700">Tap to upload</p>
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
          </>
        )}

        {/* Installments table */}
        <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Installment Schedule</h3>
        <div className="space-y-1.5">
          {loan.installments?.map((inst: any) => (
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
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  inst.status === 'PAID' ? 'bg-emerald-600 text-white' : inst.proofImage ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {inst.installmentNumber}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Week {inst.installmentNumber}</p>
                  <p className="text-[10px] text-slate-500">Due: {new Date(inst.dueDate).toLocaleDateString('en-PK')}</p>
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
      </div>

      {!isPaid && !loan.withdrawalUnlocked && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe">
          <Button
            onClick={submit}
            disabled={submitting || isPending || (!proofImage && !firstInst.proofImage)}
            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : isPending ? 'Awaiting Verification' : 'Submit 1st Installment Proof'}
          </Button>
        </div>
      )}

      <PaymentInfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </PhoneFrame>
  )
}
