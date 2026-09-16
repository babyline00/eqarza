'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { PAKISTANI_BANKS } from '@/lib/auth'
import { Check, ChevronRight } from 'lucide-react'

export function WithdrawalScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [loan, setLoan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState<'JazzCash' | 'EasyPaisa' | 'Bank' | ''>('')
  const [accountTitle, setAccountTitle] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bank, setBank] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api('/api/loan/select')
      .then((res) => setLoan(res.loan))
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  const submit = async () => {
    if (!loan) return
    if (!method) return toast({ title: 'Select method', description: 'Please select withdrawal method', variant: 'destructive' })
    if (!accountTitle.trim()) return toast({ title: 'Missing', description: 'Account title is required', variant: 'destructive' })
    if (!accountNumber.trim()) return toast({ title: 'Missing', description: 'Account number is required', variant: 'destructive' })
    if (method === 'Bank' && !bank) return toast({ title: 'Missing', description: 'Please select your bank', variant: 'destructive' })

    setSubmitting(true)
    try {
      await api('/api/loan/withdrawal-account', {
        method: 'POST',
        body: { loanId: loan.id, method, accountTitle, accountNumber, bank },
      })
      toast({ title: 'Saved!', description: 'Withdrawal account saved. Proceed to downpayment.' })
      setView('downpayment')
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Withdrawal Account" onBack={() => setView('eligibility')} />
        <div className="p-6 text-emerald-600 animate-pulse">Loading...</div>
      </PhoneFrame>
    )
  }

  if (!loan) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Withdrawal Account" onBack={() => setView('eligibility')} />
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">No active loan. Please select a loan first.</p>
          <Button onClick={() => setView('eligibility')} className="mt-4 bg-emerald-600 text-white">
            View Loan Offers
          </Button>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame showBottomNav={false}>
      <ScreenHeader title="Withdrawal Account" onBack={() => setView('eligibility')} />

      {/* Loan summary */}
      <div className="bg-emerald-50 px-5 py-4 border-b border-emerald-100">
        <p className="text-xs text-emerald-700 font-medium">Loan Amount</p>
        <p className="text-2xl font-bold text-emerald-800">Rs. {loan.amount.toLocaleString()}</p>
        <p className="text-xs text-emerald-600 mt-1">
          After approval, your loan will be sent to this account.
        </p>
      </div>

      <div className="p-5 pb-24">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Withdrawal Method</h3>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <MethodCard
            value="JazzCash"
            label="JazzCash"
            color="bg-red-50 border-red-200"
            textColor="text-red-700"
            icon="📱"
            selected={method === 'JazzCash'}
            onClick={() => setMethod('JazzCash')}
          />
          <MethodCard
            value="EasyPaisa"
            label="EasyPaisa"
            color="bg-green-50 border-green-200"
            textColor="text-green-700"
            icon="📲"
            selected={method === 'EasyPaisa'}
            onClick={() => setMethod('EasyPaisa')}
          />
          <MethodCard
            value="Bank"
            label="Bank"
            color="bg-blue-50 border-blue-200"
            textColor="text-blue-700"
            icon="🏦"
            selected={method === 'Bank'}
            onClick={() => setMethod('Bank')}
          />
        </div>

        {method && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Account Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                placeholder="Your name as per account"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                {method === 'Bank' ? 'Account Number / IBAN' : 'Mobile Account Number'}{' '}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={method === 'Bank' ? 'PK36 HABB 0000 1234 5678 9012' : '03XXXXXXXXX'}
              />
              {method !== 'Bank' && (
                <p className="text-xs text-slate-500 mt-1">Enter the JazzCash/EasyPaisa mobile number</p>
              )}
            </div>

            {method === 'Bank' && (
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Select Bank <span className="text-red-500">*</span>
                </Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger><SelectValue placeholder="Select your bank" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PAKISTANI_BANKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              🔒 Your account details are securely stored and used only to disburse your loan amount.
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 pb-safe">
        <Button
          onClick={submit}
          disabled={submitting || !method}
          className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Continue to Downpayment'}
          {!submitting && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </PhoneFrame>
  )
}

function MethodCard({
  label,
  color,
  textColor,
  icon,
  selected,
  onClick,
}: {
  value: string
  label: string
  color: string
  textColor: string
  icon: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
        selected ? 'border-emerald-500 bg-emerald-50 shadow-md' : `${color} hover:border-emerald-300`
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className={`text-xs font-semibold ${selected ? 'text-emerald-800' : textColor}`}>{label}</span>
      {selected && (
        <div className="absolute -mt-12 -mr-8 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center self-end">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}
