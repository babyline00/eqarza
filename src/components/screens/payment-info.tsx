'use client'

import { X, Info, HandCoins, Phone, Camera, BadgeCheck } from 'lucide-react'

// Bilingual (Urdu + English) payment instructions popup shown on
// the downpayment and 1st installment screens.
export function PaymentInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  const steps = [
    {
      icon: HandCoins,
      urdu: 'نیچے دیے گئے اکاؤنٹس میں سے کسی ایک میں مطلوبہ رقم بھیجیں',
      english: 'Transfer the required amount to any of the accounts below',
    },
    {
      icon: Phone,
      urdu: 'ٹرانزیکشن کے دوران اپنا موبائل نمبر لازماً لکھیں',
      english: 'Always write your registered mobile number in the transaction remarks',
    },
    {
      icon: Camera,
      urdu: 'ٹرانزیکشن کا اسکرین شاٹ لیں اور یہاں اپ لوڈ کریں',
      english: 'Take a clear screenshot of the transaction and upload it here',
    },
    {
      icon: BadgeCheck,
      urdu: 'انتظامیہ کی تصدیق کے بعد اگلا مرحلہ کھل جائے گا',
      english: 'The next step unlocks once the admin verifies your payment',
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto scroll-area p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900" dir="rtl">ادائیگی کے اصول</h3>
              <p className="text-[11px] text-slate-500">Payment Instructions</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800" dir="rtl">{s.urdu}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.english}</p>
              </div>
              <span className="w-5 h-5 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold"
        >
          سمجھ گیا — Got it
        </button>
      </div>
    </div>
  )
}