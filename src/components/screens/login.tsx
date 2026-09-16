'use client'

import { useEffect, useState } from 'react'
import { Phone, ShieldCheck, Zap, Clock, BadgeCheck } from 'lucide-react'
import { useAuth, api, fetchAppInfo } from '@/lib/store'
import { PhoneFrame } from '@/components/phone-frame'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { tr } from '@/lib/i18n'
import { LangToggle } from '@/components/lang-toggle'

export function LoginScreen() {
  const { setView, lang } = useAuth()
  const [localPhone, setLocalPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [appInfo, setAppInfo] = useState<any>({ available: false })
  const [videos, setVideos] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchAppInfo()
      .then((info) => setAppInfo(info || { available: false }))
      .catch(() => {})
    fetch('/api/videos')
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!/^03\d{9}$/.test(localPhone)) {
      toast({ title: tr(lang, 'invalid_phone'), description: tr(lang, 'invalid_phone_desc'), variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await api('/api/auth/send-otp', { method: 'POST', body: { phone: localPhone } })
      localStorage.setItem('eqarza_phone', localPhone)
      if (res.otp) {
        toast({ title: tr(lang, 'otp_code'), description: `${tr(lang, 'otp_code_desc')} ${res.otp}` })
      } else {
        toast({ title: tr(lang, 'otp_sent'), description: res.message || `${tr(lang, 'otp_sent_desc')} ${localPhone}` })
      }
      localStorage.setItem('eqarza_resend', String(res.cooldown ?? 10))
      setView('otp')
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || e, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PhoneFrame showBottomNav={false}>
      <div className="min-h-dvh flex flex-col">
        <div
          className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white px-6 pt-12 pb-10 mb-8 rounded-b-[2.5rem] relative overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to bottom right, rgba(5, 150, 104, 0.88), rgba(13, 148, 136, 0.9), rgba(4, 120, 87, 0.92)), url('/bg-header.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          <div className="absolute -top-12 -right-8 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">E-Qarza</p>
                <p className="text-[10px] text-emerald-100">{tr(lang, 'tagline')}</p>
              </div>
            </div>
            <LangToggle light />
          </div>

          <h1 className="text-2xl font-bold mb-2">{tr(lang, 'hero_title')}</h1>
          <p className="text-emerald-50 text-sm mb-4">{tr(lang, 'hero_sub')}</p>

          <div className="flex flex-wrap gap-2">
            <span className="bg-amber-400 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3 inline mr-1" /> {tr(lang, 'badge_fast')}
            </span>
            <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 inline mr-1" /> {tr(lang, 'badge_weekly')}
            </span>
            <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <BadgeCheck className="w-3 h-3 inline mr-1" /> {tr(lang, 'badge_fees')}
            </span>
          </div>
          {appInfo?.available && (
            <a
              href={appInfo.url}
              download="E-Qarza-App.apk"
              aria-label="Download the E-Qarza Android app"
              className="group relative overflow-hidden mt-4 flex w-full items-center gap-3 bg-slate-900 text-white pl-2.5 pr-5 py-2.5 rounded-2xl shadow-lg shadow-slate-900/20 ring-1 ring-white/10 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-white p-1.5 shrink-0 shadow-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.06)] relative">
                <img src="/e-qarza-logo.jpeg" alt="E-Qarza" className="w-full h-full object-contain" />
              </span>
              <span className="text-left leading-tight relative min-w-0">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  {tr(lang, 'verified_badge')}
                </span>
                <span className="block text-[15px] font-bold mt-0.5 tracking-tight flex items-center gap-1.5">
                  <svg viewBox="0 0 512 512" className="w-4 h-4 shrink-0" fill="currentColor" aria-hidden="true">
                    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
                  </svg>
                  {tr(lang, 'install_app')}
                </span>
              </span>
            </a>
          )}
        </div>

        <div className="flex-1 px-6 -mt-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 border border-slate-100">
            <h2 className="text-base font-semibold text-slate-800 mb-1">{tr(lang, 'phone_title')}</h2>
            <p className="text-xs text-slate-500 mb-3">{tr(lang, 'phone_sub')}</p>

            <div className="flex items-center gap-2 border-2 border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 transition-colors">
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
                <span className="text-lg">🇵🇰</span>
                <span className="text-sm font-semibold text-slate-700">+92</span>
              </div>
              <Phone className="w-4 h-4 text-slate-400" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder={tr(lang, 'phone_placeholder')}
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 outline-none text-sm font-medium placeholder:text-slate-400 bg-transparent"
              />
            </div>

            <Button
              onClick={submit}
              disabled={loading}
              className="w-full mt-4 bg-amber-400 hover:bg-amber-500 text-white font-bold h-12 rounded-xl shadow-md disabled:opacity-50"
            >
              {loading ? tr(lang, 'sending') : tr(lang, 'send_otp')}
            </Button>

            <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
              {tr(lang, 'agree')}{' '}
              <span className="text-emerald-600 underline">{tr(lang, 'terms')}</span> {lang === 'ur' ? 'رہیں اور' : 'and'}{' '}
              <span className="text-emerald-600 underline">{tr(lang, 'privacy')}</span>
              {lang === 'ur' ? ' سے اتفاق کرتے ہیں۔' : '.'}
            </p>
          </div>

          

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{tr(lang, 'how_works')}</h3>
            <div className="flex items-center justify-between px-2">
              <Step n={1} icon="📝" label={tr(lang, 'step_info')} />
              <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-2" />
              <Step n={2} icon="✓" label={tr(lang, 'step_verified')} />
              <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-2" />
              <Step n={3} icon="💰" label={tr(lang, 'step_money')} />
            </div>
          </div>

          {videos.length > 0 && (
            <div className="mt-7">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Our Satisfied Customers</h3>
              <p className="text-[11px] text-slate-400 mb-3">Real customers, real stories.</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
                {videos.map((v) => (
                  <div key={v.id} className="w-48 shrink-0 snap-start bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-black aspect-[9/13]">
                      <video src={v.url} controls preload="metadata" playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-slate-800 truncate">{v.title}</p>
                      {v.subtitle && <p className="text-[10px] text-slate-500 truncate">{v.subtitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  )
}

function Step({ n, icon, label }: { n: number; icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-base relative">
        {icon}
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {n}
        </span>
      </div>
      <span className="text-[10px] text-slate-600 font-medium text-center">{label}</span>
    </div>
  )
}

export function OtpScreen() {
  const { setView, setUser, lang } = useAuth()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(() => {
    if (typeof window !== 'undefined') return Number(localStorage.getItem('eqarza_resend') || 0) || 0
    return 0
  })
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('eqarza_phone') || ''
    return ''
  })
  const { toast } = useToast()

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setInterval(() => setResendTimer((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendTimer > 0])

  const verify = async () => {
    if (otp.length !== 4) {
      toast({ title: tr(lang, 'invalid_otp'), description: tr(lang, 'invalid_otp_desc'), variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await api('/api/auth/verify-otp', { method: 'POST', body: { phone, otp } })
      setUser({ token: res.token, userId: res.userId, phone: res.phone })
      toast({ title: 'Welcome!', description: 'Logged in successfully' })
      setView('dashboard')
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendTimer > 0) return
    try {
      const res = await api('/api/auth/send-otp', { method: 'POST', body: { phone } })
      if (res.otp) {
        toast({ title: tr(lang, 'otp_code'), description: `${tr(lang, 'otp_code_desc')} ${res.otp}` })
      } else {
        toast({ title: tr(lang, 'otp_sent'), description: res.message })
      }
      setResendTimer(res.cooldown ?? 10)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <PhoneFrame showBottomNav={false}>
      <div className="min-h-dvh flex flex-col px-6 pt-16">
        <div className="text-center mb-8">
          <div className="w-28 h-28 mx-auto mb-4 relative">
            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-emerald-50 rounded-full flex items-center justify-center">
              <div className="text-5xl">✈️</div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-1">{tr(lang, 'otp_title')}</h1>
          <p className="text-sm text-slate-500">
            {tr(lang, 'otp_sent_to')} <br />
            <span className="font-semibold text-emerald-700">{phone}</span>
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <InputOTP maxLength={4} value={otp} onChange={setOtp}>
            <InputOTPGroup className="gap-3">
              <InputOTPSlot index={0} className="w-14 h-14 text-2xl font-bold border-2 border-slate-200 rounded-xl" />
              <InputOTPSlot index={1} className="w-14 h-14 text-2xl font-bold border-2 border-slate-200 rounded-xl" />
              <InputOTPSlot index={2} className="w-14 h-14 text-2xl font-bold border-2 border-slate-200 rounded-xl" />
              <InputOTPSlot index={3} className="w-14 h-14 text-2xl font-bold border-2 border-slate-200 rounded-xl" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="text-center mb-6">
          {resendTimer > 0 ? (
            <p className="text-sm text-slate-500">
              {tr(lang, 'resend_in')} <span className="font-semibold text-emerald-600">{resendTimer}s</span>
            </p>
          ) : (
            <button onClick={resend} className="text-sm text-emerald-600 font-semibold hover:underline">
              {tr(lang, 'resend')}
            </button>
          )}
        </div>

        <Button
          onClick={verify}
          disabled={loading}
          className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold h-12 rounded-xl shadow-md disabled:opacity-50"
        >
          {loading ? tr(lang, 'verifying') : tr(lang, 'continue')}
        </Button>

        <button
          onClick={() => setView('login')}
          className="mt-4 mx-auto block text-sm text-slate-500 hover:text-emerald-700"
        >
          {tr(lang, 'change_phone')}
        </button>
      </div>
    </PhoneFrame>
  )
}