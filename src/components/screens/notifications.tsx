'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { InfiniteList } from '@/components/infinite-list'
import { useToast } from '@/hooks/use-toast'
import { Bell, CheckCircle2, Clock, AlertCircle, Award, KeyRound } from 'lucide-react'

export function NotificationsScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api('/api/notifications')
      .then((res) => setNotifications(res.notifications || []))
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    try {
      await api('/api/notifications', { method: 'POST', body: { id } })
      load()
    } catch (e: any) {
      // silent
    }
  }

  const iconFor = (type: string) => {
    switch (type) {
      case 'DOWNPAYMENT_APPROVED':
      case 'WITHDRAWAL_UNLOCKED':
      case 'LOAN_COMPLETED':
      case 'KYC_APPROVED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      case 'INSTALLMENT_REMINDER':
      case 'WEEKLY_REMINDER':
        return <Clock className="w-5 h-5 text-amber-600" />
      case 'DOWNPAYMENT_REJECTED':
      case 'KYC_REJECTED':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'OTP':
        return <KeyRound className="w-5 h-5 text-blue-600" />
      default:
        return <Bell className="w-5 h-5 text-slate-600" />
    }
  }

  return (
    <PhoneFrame activeTab="notifications">
      <ScreenHeader title="Notifications" onBack={() => setView('dashboard')} />

      <div className="p-4 pb-20">
        {loading && <p className="text-center text-slate-500 text-sm">Loading...</p>}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
            <p className="text-xs text-slate-500 mt-1">
              You&apos;ll see reminders about your installments and loan updates here.
            </p>
          </div>
        )}

        <InfiniteList
          items={notifications}
          chunk={15}
          className="space-y-2"
          render={(n: any) => (
            <button
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                n.read
                  ? 'bg-white border-slate-200'
                  : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <div className="shrink-0 mt-0.5">{iconFor(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-slate-800 truncate">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />}
                </div>
                {n.type === 'OTP' ? (
                  <div className="mt-1">
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">Your verification code is:</p>
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3 inline-block">
                      <p className="text-2xl font-mono font-bold text-blue-700 tracking-[0.3em]">
                        {n.body.match(/\d{4}/)?.[0] || ''}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Expires in 5 minutes. Don&apos;t share it.</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(n.createdAt).toLocaleString('en-PK')}
                </p>
              </div>
            </button>
          )}
        />

        {/* Weekly reminder info card */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Award className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Weekly Installment Reminders</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              You&apos;ll receive a reminder every week to pay your installment on time. Late payments may affect your
              eligibility for future loans.
            </p>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
