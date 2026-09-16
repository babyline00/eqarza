'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth, api, uploadAppFile, deleteAppFile, fetchAppInfo, MAX_APP_UPLOAD_SIZE } from '@/lib/store'
import { playNotificationSound } from '@/lib/notification-sound'
import { openImage } from '@/lib/lightbox'
import { AdminFrame } from '@/components/phone-frame'
import { InfiniteList, useChunked } from '@/components/infinite-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  X,
  Calendar,
  ShieldCheck,
  Camera,
  Building2,
  Ban,
  RotateCcw,
  Trash2,
  ListChecks,
  Smartphone,
  Download,
  UploadCloud,
  History,
  RefreshCw,
  LayoutGrid,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Check,
  Video as VideoIcon,
  Send,
  Percent,
  MessageCircle,
  Coins,
  UserCog,
  Plus,
  Bell,
  ChevronRight,
} from 'lucide-react'

type Tab = 'overview' | 'kyc' | 'payments' | 'withdrawals' | 'users' | 'loans' | 'videos' | 'bank' | 'staff' | 'settings' | 'logs'
type KycFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
type PayFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
type WdFilter = 'PENDING' | 'PAID' | 'REJECTED' | 'ALL'
type LoanFilter = 'ALL' | 'DP_PENDING' | 'DP_APPROVED' | 'INST1_APPROVED' | 'WITHDRAWN' | 'REPAID' | 'REJECTED'

const KYC_REJECT_REASONS = [
  'Blurry / unclear photo',
  'Selfie does not match CNIC photo',
  'CNIC number does not match record',
  'Missing or damaged CNIC document',
  'Incorrect/inconsistent personal details',
  'Fake or manipulated document',
  'Other',
]

const PAYMENT_REJECT_REASONS = [
  'Not a valid payment receipt',
  'Proof is blurry / not readable',
  'Incorrect amount paid',
  'Payment not received in account',
  'Fake or manipulated proof',
  'Wrong deposit method used',
  'Other',
]

export function AdminDashboardScreen() {
  const { setView, setAdmin, adminUsername, adminIsStaff, logoutAdmin } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Identity of the logged-in super admin / staff — drives sidebar + permissions
  const [me, setMe] = useState<any>(null)
  const meRef = useRef<any>(null)

  // Core data
  const [stats, setStats] = useState<any>({})
  const [loans, setLoans] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [withdrawalCounts, setWithdrawalCounts] = useState<any>({ pending: 0, paid: 0, rejected: 0, all: 0 })
  const [videos, setVideos] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [appInfo, setAppInfo] = useState<any>({ available: false })

  // Section filters & searches
  const [kycFilter, setKycFilter] = useState<KycFilter>('PENDING')
  const [kycSearch, setKycSearch] = useState('')
  const [payFilter, setPayFilter] = useState<PayFilter>('PENDING')
  const [paySearch, setPaySearch] = useState('')
  const [wdFilter, setWdFilter] = useState<WdFilter>('PENDING')
  const [wdSearch, setWdSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [loanFilter, setLoanFilter] = useState<LoanFilter>('ALL')
  const [loanSearch, setLoanSearch] = useState('')

  // KYC review state
  const [kycRejectingId, setKycRejectingId] = useState<string | null>(null)
  const [kycRejectReason, setKycRejectReason] = useState('')
  const [kycRejectNote, setKycRejectNote] = useState('')

  // Payment review state
  const [dpRejectingId, setDpRejectingId] = useState<string | null>(null)
  const [dpRejectReason, setDpRejectReason] = useState('')
  const [dpRejectNote, setDpRejectNote] = useState('')
  const [instRejectingId, setInstRejectingId] = useState<string | null>(null)
  const [instRejectReason, setInstRejectReason] = useState('')
  const [instRejectNote, setInstRejectNote] = useState('')

  // Withdrawal action state
  const [wdTxnIds, setWdTxnIds] = useState<Record<string, string>>({})
  const [wdBusyId, setWdBusyId] = useState<string | null>(null)
  const [wdRejectingId, setWdRejectingId] = useState<string | null>(null)
  const [wdRejectNote, setWdRejectNote] = useState('')

  // Rejection-reason option lists (defaults + admin-managed custom options)
  const [kycReasons, setKycReasons] = useState<string[]>(KYC_REJECT_REASONS)
  const [payReasons, setPayReasons] = useState<string[]>(PAYMENT_REJECT_REASONS)

  // Videos upload state
  const [videoForm, setVideoForm] = useState<{ title: string; subtitle: string; file: File | null }>({ title: '', subtitle: '', file: null })
  const [videoUploading, setVideoUploading] = useState(false)

  // Settings state
  const [smsOtpEnabled, setSmsOtpEnabled] = useState(true)
  const [adminPath, setAdminPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname.replace(/^\/|\/$/g, '') : 'admin'))
  const [smsToggleLoading, setSmsToggleLoading] = useState(false)
  const [referralBonus, setReferralBonus] = useState(200)
  const [downpaymentPct, setDownpaymentPct] = useState(10)
  const [markupPct, setMarkupPct] = useState(0)
  const [loyaltyReducePct, setLoyaltyReducePct] = useState(0)
  const [loyaltyMinMarkupPct, setLoyaltyMinMarkupPct] = useState(0)
  const [loanPackages, setLoanPackages] = useState('')
  const [tawkEnabled, setTawkEnabled] = useState(true)
  const [tawkWidgetId, setTawkWidgetId] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [bankForm, setBankForm] = useState<any>({})
  const [bankSaving, setBankSaving] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwChanging, setPwChanging] = useState(false)
  const [smsApi, setSmsApi] = useState<{
    endpoint: string
    secret: string
    mode: 'credits' | 'devices'
    gateway: string
    device: string
    sim: string
    account: string
    channel: 'sms' | 'whatsapp' | 'both'
  }>({
    endpoint: 'https://matrixsender.com/api/send/sms',
    secret: '',
    mode: 'credits',
    gateway: '',
    device: '',
    sim: '1',
    account: '',
    channel: 'sms',
  })
  const [appBusy, setAppBusy] = useState(false)

  const seenRef = useRef<{
    loans: string[]
    users: string[]
    kyc: string[]
    kycTs: Record<string, number>
    downpayments: string[]
    installments: string[]
  }>({ loans: [], users: [], kyc: [], kycTs: {}, downpayments: [], installments: [] })

  // Prominent pop-up (bigger than a toast) fired from the 20s poll. It lists
  // every module that got new activity and jumps straight to that tab.
  const [notifPopups, setNotifPopups] = useState<Array<{ label: string; count: number; tab: Tab }>>([])
  const popupTimerRef = useRef<any>(null)

  // Module gate: super admin sees everything, staff only their role's modules.
  const canSee = (mod: 'kyc' | 'payments' | 'loans' | 'users') => {
    const m = meRef.current
    return !m?.isStaff || !!m?.permissions?.[mod]
  }

  const dismissPopups = () => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current)
      popupTimerRef.current = null
    }
    setNotifPopups([])
  }

  const showPopups = (items: Array<{ label: string; count: number; tab: Tab }>) => {
    dismissPopups()
    if (!items.length) return
    setNotifPopups(items)
    popupTimerRef.current = setTimeout(() => setNotifPopups([]), 8000)
  }

  const snapshotFrom = (p: { loans: any[]; users: any[] }) => ({
    loans: (p.loans || []).map((x: any) => x.id),
    users: p.users.map((x: any) => x.id),
    downpayments: (p.loans || [])
      .filter((x: any) => x.downpaymentStatus === 'PENDING' && x.downpaymentProof)
      .map((x: any) => x.id),
    installments: (p.loans || [])
      .flatMap(
        (x: any) =>
          (x.installments || [])
            .filter((i: any) => i.proofImage && i.status !== 'PAID')
            .map((i: any) => i.id)
      ),
    kyc: p.users
      .filter(
        (u: any) =>
          u.kyc &&
          (u.kyc.kycStatus === 'PENDING' || !u.kyc.kycStatus) &&
          (u.kyc.cnicFrontImage || u.kyc.selfieImage)
      )
      .map((u: any) => u.id),
    kycTs: Object.fromEntries(
      p.users
        .filter(
          (u: any) =>
            u.kyc &&
            (u.kyc.kycStatus === 'PENDING' || !u.kyc.kycStatus) &&
            (u.kyc.cnicFrontImage || u.kyc.selfieImage)
        )
        .map((u: any) => [u.id, u.kyc.updatedAt ? new Date(u.kyc.updatedAt).getTime() : 0])
    ),
  })

  const fetchData = async (identity = meRef.current) => {
    const m = identity
    const isSuper = !m?.isStaff
    const wants = (mod: string) => !m?.isStaff || !!m?.permissions?.[mod]

    // Only fetch what this identity can actually see/use
    const [st, l, u, s, b, w, v, app] = await Promise.all([
      api('/api/admin/stats'),
      wants('loans') || wants('payments') ? api('/api/admin/loans') : Promise.resolve(null),
      wants('users') || wants('kyc') ? api('/api/admin/users') : Promise.resolve(null),
      isSuper ? api('/api/admin/settings') : Promise.resolve(null),
      isSuper ? api('/api/admin/bank-details') : Promise.resolve(null),
      wants('withdrawals') ? api('/api/admin/withdrawals?filter=ALL') : Promise.resolve(null),
      isSuper ? api('/api/admin/videos') : Promise.resolve(null),
      isSuper ? fetchAppInfo() : Promise.resolve(null),
    ])
    return {
      stats: st,
      loans: l?.loans || [],
      users: u?.users || [],
      settings: s,
      bank: b,
      wd: w,
      videos: v?.videos || [],
      app,
    }
  }

  // applyData refreshes the VIEW screens (stats cards, lists, badges).
  // Form inputs (settings fields, SMS gateway form, etc.) are only touched on
  // the initial load ({ full: true }) so a refresh never clobbers edits in
  // progress — per the "refresh only updates notifications + views" rule.
  const applyData = (p: any, opts?: { full?: boolean }) => {
    const full = !!opts?.full
    setStats(p.stats || {})
    setLoans(p.loans || [])
    setUsers(p.users || [])
    if (p.wd) {
      setWithdrawals(p.wd.withdrawals || [])
      setWithdrawalCounts(p.wd.counts || { pending: 0, paid: 0, rejected: 0, all: 0 })
    }
    if (p.videos) setVideos(p.videos)
    if (p.bank) setBankAccounts(p.bank.accounts || [])
    if (p.app) setAppInfo(p.app || { available: false })

    if (full && p.settings) {
      setSmsOtpEnabled(p.settings.smsOtpEnabled ?? true)
      setReferralBonus(p.settings.referralBonus ?? 200)
      setDownpaymentPct(p.settings.downpaymentPct ?? 10)
      setMarkupPct(p.settings.loanConfig?.markupPct ?? 0)
      setLoyaltyReducePct(p.settings.loanConfig?.loyaltyReducePct ?? 0)
      setLoyaltyMinMarkupPct(p.settings.loanConfig?.loyaltyMinMarkupPct ?? 0)
      setLoanPackages((p.settings.loanConfig?.packages || []).join(','))
      setTawkEnabled(p.settings.tawkEnabled ?? true)
      setTawkWidgetId(p.settings.tawkWidgetId || '')
      const storedPath = Array.isArray(p.settings.settings)
        ? (p.settings.settings.find((s: any) => s.key === 'admin_path')?.value || '')
        : ''
      if (storedPath) setAdminPath(String(storedPath).replace(/^\/|\/$/g, ''))
      if (p.settings.smsApi) {
        setSmsApi({
          endpoint: p.settings.smsApi.matrixsender?.endpoint || 'https://matrixsender.com/api/send/sms',
          secret: p.settings.smsApi.matrixsender?.secret || '',
          mode: p.settings.smsApi.matrixsender?.mode === 'devices' ? 'devices' : 'credits',
          gateway: p.settings.smsApi.matrixsender?.gateway || '',
          device: p.settings.smsApi.matrixsender?.device || '',
          sim: p.settings.smsApi.matrixsender?.sim || '1',
          account: p.settings.smsApi.matrixsender?.account || '',
          channel: p.settings.smsApi.channel === 'whatsapp' || p.settings.smsApi.channel === 'both' ? p.settings.smsApi.channel : 'sms',
        })
      }
    }
  }

  const loadRejectOptions = () => {
    api('/api/admin/reject-options')
      .then((r) => {
        if (Array.isArray(r.kyc) && r.kyc.length) setKycReasons([...KYC_REJECT_REASONS.filter((x) => x !== 'Other'), ...r.kyc, 'Other'])
        if (Array.isArray(r.payment) && r.payment.length) setPayReasons([...PAYMENT_REJECT_REASONS.filter((x) => x !== 'Other'), ...r.payment, 'Other'])
      })
      .catch(() => {
        // defaults are already in place — custom options are a nice-to-have
      })
  }

  const addRejectOption = async (kind: 'kyc' | 'payment', reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast({ title: 'Empty option', description: 'Type the new reason first.', variant: 'destructive' })
      return false
    }
    const list = kind === 'kyc' ? kycReasons : payReasons
    if (list.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Already exists', description: 'That option is already in the list.', variant: 'destructive' })
      return false
    }
    try {
      const r = await api('/api/admin/reject-options', { method: 'POST', body: { kind, action: 'add', reason: trimmed } })
      // rebuild list from defaults + returned custom options
      const defaults = (kind === 'kyc' ? KYC_REJECT_REASONS : PAYMENT_REJECT_REASONS).filter((x) => x !== 'Other')
      const merged = [...defaults, ...(r.options || []), 'Other']
      if (kind === 'kyc') setKycReasons(merged)
      else setPayReasons(merged)
      toast({ title: 'Option added', description: `"${trimmed}" is now available in the dropdown.` })
      return true
    } catch (e: any) {
      toast({ title: 'Could not add option', description: e.message, variant: 'destructive' })
      return false
    }
  }

  const removeRejectOption = async (kind: 'kyc' | 'payment', reason: string) => {
    try {
      const r = await api('/api/admin/reject-options', { method: 'POST', body: { kind, action: 'remove', reason } })
      const defaults = (kind === 'kyc' ? KYC_REJECT_REASONS : PAYMENT_REJECT_REASONS).filter((x) => x !== 'Other')
      const merged = [...defaults, ...(r.options || []), 'Other']
      if (kind === 'kyc') setKycReasons(merged)
      else setPayReasons(merged)
      if ((kind === 'kyc' ? kycRejectReason : dpRejectReason) === reason) {
        if (kind === 'kyc') setKycRejectReason('')
        else setDpRejectReason('')
      }
      toast({ title: 'Option removed', description: `"${reason}" was removed from the dropdown.` })
      return true
    } catch (e: any) {
      toast({ title: 'Could not remove option', description: e.message, variant: 'destructive' })
      return false
    }
  }

  // Staff are not allowed to access admin — redirect to user app
  useEffect(() => {
    if (adminIsStaff) {
      setView('login')
    }
  }, [adminIsStaff, setView])

  const load = () => {
    if (adminIsStaff) {
      setView('login')
      return
    }
    api('/api/admin/me')
      .then((m) => {
        setMe(m)
        meRef.current = m
        return fetchData(m)
      })
      .then((p) => {
        applyData(p, { full: true })
        seenRef.current = snapshotFrom(p)
        loadRejectOptions()
      })
      .catch((e) => {
        if (e.message.includes('Unauthorized') || e.message.includes('not permitted')) {
          logoutAdmin()
          setView('admin_login')
        } else toast({ title: 'Error', description: e.message, variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    fetchData()
      .then((p) => {
        // View screens + notifications only — form inputs stay untouched
        applyData(p)
        seenRef.current = snapshotFrom(p)
      })
      .catch((e) => {
        if (e.message.includes('Unauthorized')) {
          logoutAdmin()
          setView('admin_login')
        } else toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' })
      })
      .finally(() => setRefreshing(false))
  }

  useEffect(() => { load() }, [])

  const poll = async () => {
    try {
      const next = await api('/api/admin/notifications')
      const prev = seenRef.current

      const newKyc = (next.kyc || []).filter((id: string) => !prev.kyc.includes(id))
      // Cases that were already pending but got newer documents (resubmission / doc update)
      const updatedKyc = (next.kyc || []).filter(
        (id: string) =>
          prev.kyc.includes(id) && (next.kycTs?.[id] || 0) > (prev.kycTs?.[id] || 0)
      )
      const newDownpayments = (next.downpayments || []).filter((id: string) => !prev.downpayments.includes(id))
      const newInstallments = (next.installments || []).filter((id: string) => !prev.installments.includes(id))
      const newLoans = (next.loans || []).filter((id: string) => !prev.loans.includes(id))
      const newUsers = (next.users || []).filter((id: string) => !prev.users.includes(id))

      seenRef.current = next

      const hasNew = newKyc.length || updatedKyc.length || newDownpayments.length || newInstallments.length || newLoans.length || newUsers.length
      if (hasNew) {
        setRefreshing(true)
        try {
          const p = await fetchData()
          applyData(p)
        } finally {
          setRefreshing(false)
        }
      }

      // Build list of pop-ups + toasts, gated by the admin's permissions.
      const popups: Array<{ label: string; count: number; tab: Tab }> = []
      if (newKyc.length > 0 && canSee('kyc')) {
        playNotificationSound('kyc')
        toast({ title: `${newKyc.length} new KYC submission${newKyc.length > 1 ? 's' : ''}`, description: 'Open KYC Review to check the document(s).' })
        popups.push({ label: 'KYC submission', count: newKyc.length, tab: 'kyc' })
      }
      if (updatedKyc.length > 0 && canSee('kyc')) {
        playNotificationSound('kyc')
        toast({ title: `KYC document${updatedKyc.length > 1 ? 's' : ''} updated`, description: 'A pending case has newer documents. Open KYC Review to re-check.' })
        popups.push({ label: 'KYC doc update', count: updatedKyc.length, tab: 'kyc' })
      }
      if (newDownpayments.length > 0 && canSee('payments')) {
        playNotificationSound('payment')
        toast({ title: `${newDownpayments.length} new downpayment proof${newDownpayments.length > 1 ? 's' : ''}`, description: 'Open Payments to verify.' })
        popups.push({ label: 'downpayment proof', count: newDownpayments.length, tab: 'payments' })
      }
      if (newInstallments.length > 0 && canSee('payments')) {
        playNotificationSound('payment')
        toast({ title: `${newInstallments.length} new installment proof${newInstallments.length > 1 ? 's' : ''}`, description: 'Open Payments to confirm.' })
        popups.push({ label: 'installment proof', count: newInstallments.length, tab: 'payments' })
      }
      if (newLoans.length > 0 && canSee('loans')) {
        playNotificationSound('loan')
        toast({ title: `${newLoans.length} new loan application${newLoans.length > 1 ? 's' : ''}`, description: 'Open Loans to review.' })
        popups.push({ label: 'loan application', count: newLoans.length, tab: 'loans' })
      }
      if (newUsers.length > 0 && canSee('users')) {
        playNotificationSound('other')
        toast({ title: `${newUsers.length} new user${newUsers.length > 1 ? 's' : ''} registered`, description: 'Open Users to view the new account(s).' })
        popups.push({ label: 'user registration', count: newUsers.length, tab: 'users' })
      }

      if (popups.length) showPopups(popups)
    } catch {
      // silent — transient poll failures should not spam the admin
    }
  }

  useEffect(() => {
    const id = setInterval(poll, 20000)
    return () => clearInterval(id)
  }, [])

  // ---------- Actions ----------

  const toggleSmsOtp = async () => {
    const next = !smsOtpEnabled
    setSmsToggleLoading(true)
    try {
      await api('/api/admin/settings', { method: 'POST', body: { key: 'sms_otp_enabled', value: String(next) } })
      setSmsOtpEnabled(next)
      toast({
        title: next ? 'SMS OTP enabled' : 'SMS OTP disabled',
        description: next ? 'OTP codes will be sent via the SMS/WhatsApp gateway when available.' : 'OTP codes are returned inline (demo mode).',
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSmsToggleLoading(false)
    }
  }

  const saveSettings = async () => {
    const bonus = Number(referralBonus)
    const dpPct = Number(downpaymentPct)
    const mkPct = Number(markupPct)
    const lyPct = Number(loyaltyReducePct)
    const lyMin = Number(loyaltyMinMarkupPct)
    if (!Number.isFinite(bonus) || bonus < 0) return toast({ title: 'Invalid referral bonus', description: 'Please enter a valid amount', variant: 'destructive' })
    if (!Number.isFinite(dpPct) || dpPct <= 0 || dpPct > 100) return toast({ title: 'Invalid downpayment', description: 'Downpayment % must be between 1 and 100', variant: 'destructive' })
    if (!Number.isFinite(mkPct) || mkPct < 0 || mkPct > 100) return toast({ title: 'Invalid markup', description: 'Markup % must be between 0 and 100', variant: 'destructive' })
    if (!Number.isFinite(lyPct) || lyPct < 0 || lyPct > 100) return toast({ title: 'Invalid loyalty %', description: 'Loyalty reduce % must be between 0 and 100', variant: 'destructive' })
    if (!Number.isFinite(lyMin) || lyMin < 0 || lyMin > 100) return toast({ title: 'Invalid minimum markup', description: 'Minimum markup % must be between 0 and 100', variant: 'destructive' })
    const pkgs = loanPackages.split(',').map((s) => s.trim()).filter(Boolean)
    for (const p of pkgs) {
      if (!Number.isFinite(Number(p)) || Number(p) <= 0) {
        return toast({ title: 'Invalid loan packages', description: 'Use comma-separated PKR amounts, e.g. 8000,14000,18500,24000', variant: 'destructive' })
      }
    }
    const newAdminPath = '/' + adminPath.trim().replace(/^\/+|\/+$/g, '')
    if (!/^\/[a-zA-Z0-9_-]+$/.test(newAdminPath)) {
      return toast({ title: 'Invalid admin path', description: 'Use a single path segment, e.g. /admin or /newadmin', variant: 'destructive' })
    }
    const currentPath = window.location.pathname.replace(/\/$/, '')
    setSettingsSaving(true)
    try {
      const posts: Array<{ key: string; value: string }> = [
        { key: 'admin_path', value: newAdminPath },
        { key: 'referral_bonus', value: String(Math.round(bonus)) },
        { key: 'downpayment_pct', value: String(Math.round(dpPct)) },
        { key: 'markup_pct', value: String(mkPct) },
        { key: 'loyalty_reduce_pct', value: String(lyPct) },
        { key: 'loyalty_min_markup_pct', value: String(lyMin) },
        { key: 'loan_packages', value: pkgs.join(',') },
        { key: 'tawk_enabled', value: String(tawkEnabled) },
        { key: 'tawk_widget_id', value: tawkWidgetId.trim() },
        { key: 'sms_matrixsender_endpoint', value: smsApi.endpoint.trim() },
        { key: 'sms_matrixsender_secret', value: smsApi.secret.trim() },
        { key: 'sms_matrixsender_mode', value: smsApi.mode },
        { key: 'sms_matrixsender_gateway', value: smsApi.gateway.trim() },
        { key: 'sms_matrixsender_device', value: smsApi.device.trim() },
        { key: 'sms_matrixsender_sim', value: smsApi.sim.trim() },
        { key: 'sms_matrixsender_wa_account', value: smsApi.account.trim() },
        { key: 'sms_otp_channel', value: smsApi.channel },
      ]
      for (const body of posts) {
        await api('/api/admin/settings', { method: 'POST', body })
      }
      toast({ title: 'Settings saved', description: 'Your configuration has been updated.' })
      refresh()
      if ((currentPath || '/') !== newAdminPath) {
        window.setTimeout(() => {
          window.location.assign(newAdminPath)
        }, 800)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const uploadApp = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast({ title: 'Invalid file', description: 'Please select an .apk file', variant: 'destructive' })
      return
    }
    if (file.size > MAX_APP_UPLOAD_SIZE) {
      toast({ title: 'File too large', description: `Maximum ${Math.round(MAX_APP_UPLOAD_SIZE / (1024 * 1024))}MB allowed`, variant: 'destructive' })
      return
    }
    setAppBusy(true)
    try {
      const res = await uploadAppFile(file)
      setAppInfo({ available: true, url: res.url, size: res.size, uploadedAt: String(Date.now()), fileName: 'eqarza-app.apk' })
      toast({ title: 'App uploaded', description: 'Users can now download the app from the home page.' })
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload the app', variant: 'destructive' })
    } finally {
      setAppBusy(false)
    }
  }

  const deleteApp = async () => {
    if (!confirm('Remove the uploaded app? Users will no longer see the Download button.')) return
    setAppBusy(true)
    try {
      await deleteAppFile()
      setAppInfo({ available: false })
      toast({ title: 'App removed', description: 'The download link has been disabled.' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not remove the app', variant: 'destructive' })
    } finally {
      setAppBusy(false)
    }
  }

  const changeAdminPassword = async () => {
    if (!pwCurrent || !pwNew) {
      toast({ title: 'Missing fields', description: 'Enter your current and new password', variant: 'destructive' })
      return
    }
    if (pwNew.length < 6) {
      toast({ title: 'Weak password', description: 'New password must be at least 6 characters', variant: 'destructive' })
      return
    }
    if (pwNew !== pwConfirm) {
      toast({ title: 'Passwords do not match', description: 'Confirm password must match the new password', variant: 'destructive' })
      return
    }
    setPwChanging(true)
    try {
      const res = await api('/api/admin/change-password', { method: 'POST', body: { currentPassword: pwCurrent, newPassword: pwNew } })
      setAdmin({ token: res.token, username: res.username || adminUsername || 'admin' })
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      toast({ title: 'Password updated', description: 'Your admin password has been changed successfully.' })
    } catch (e: any) {
      toast({ title: 'Password change failed', description: e.message, variant: 'destructive' })
    } finally {
      setPwChanging(false)
    }
  }

  // ---- KYC ----
  const approveKyc = async (userId: string) => {
    if (!confirm('Approve this KYC? The user will be able to apply for loans.')) return
    try {
      await api('/api/admin/kyc', { method: 'POST', body: { userId, status: 'APPROVED' } })
      toast({ title: 'KYC Approved!', description: 'User can now apply for loans.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const rejectKyc = async (userId: string, reasonOverride?: string) => {
    const reason = reasonOverride || (kycRejectReason === 'Other' && kycRejectNote.trim() ? kycRejectNote.trim() : kycRejectReason)
    if (!reason) {
      toast({ title: 'Reason required', description: 'Please select a rejection reason', variant: 'destructive' })
      return
    }
    try {
      await api('/api/admin/kyc', { method: 'POST', body: { userId, status: 'REJECTED', note: reason } })
      toast({ title: 'KYC Rejected', description: 'User will be notified to re-submit with the reason.' })
      setKycRejectingId(null)
      setKycRejectReason('')
      setKycRejectNote('')
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const deleteKycCase = async (userId: string) => {
    if (!confirm('Delete this KYC case? The user account stays and can resubmit documents.')) return
    try {
      await api(`/api/admin/kyc?userId=${userId}`, { method: 'DELETE' })
      toast({ title: 'Case deleted', description: 'The KYC submission has been removed.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---- Payments (downpayments + installments) ----
  const approveDownpayment = async (loanId: string) => {
    if (!confirm('Approve this downpayment? This will create 4 weekly installments for the user.')) return
    try {
      await api('/api/admin/approve-downpayment', { method: 'POST', body: { loanId } })
      toast({ title: 'Approved!', description: 'Downpayment approved. User can now pay 1st installment.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const rejectDownpayment = async (loanId: string, reasonOverride?: string) => {
    const reason = reasonOverride || (dpRejectReason === 'Other' && dpRejectNote.trim() ? dpRejectNote.trim() : dpRejectReason)
    if (!reason) {
      toast({ title: 'Reason required', description: 'Please select a rejection reason', variant: 'destructive' })
      return
    }
    try {
      await api('/api/admin/reject-downpayment', { method: 'POST', body: { loanId, note: reason } })
      toast({ title: 'Rejected', description: 'Downpayment rejected. User will be asked to re-upload.' })
      setDpRejectingId(null)
      setDpRejectReason('')
      setDpRejectNote('')
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const confirmInstallment = async (installmentId: string) => {
    if (!confirm('Confirm this installment as paid?')) return
    try {
      await api('/api/admin/confirm-installment', { method: 'POST', body: { installmentId } })
      toast({ title: 'Confirmed!', description: 'Installment marked as paid.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const rejectInstallment = async (installmentId: string, reasonOverride?: string) => {
    const reason = reasonOverride || (instRejectReason === 'Other' && instRejectNote.trim() ? instRejectNote.trim() : instRejectReason)
    if (!reason) {
      toast({ title: 'Reason required', description: 'Please select a rejection reason', variant: 'destructive' })
      return
    }
    try {
      await api('/api/admin/reject-installment', { method: 'POST', body: { installmentId, note: reason } })
      toast({ title: 'Rejected', description: 'Installment proof rejected. User will be asked to re-upload.' })
      setInstRejectingId(null)
      setInstRejectReason('')
      setInstRejectNote('')
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---- Withdrawals ----
  const markWithdrawalPaid = async (loanId: string) => {
    const txnId = (wdTxnIds[loanId] || '').trim()
    if (!txnId) {
      toast({ title: 'Transaction ID required', description: 'Enter the Transaction ID after sending the money.', variant: 'destructive' })
      return
    }
    if (!confirm(`Mark this withdrawal as PAID with Transaction ID "${txnId}"? The user will be notified.`)) return
    setWdBusyId(loanId)
    try {
      await api('/api/admin/withdrawals', { method: 'PATCH', body: { id: loanId, action: 'mark_paid', txnId } })
      toast({ title: 'Marked paid & ID sent', description: 'The user has been notified with the transaction ID.' })
      setWdTxnIds((p) => ({ ...p, [loanId]: '' }))
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setWdBusyId(null)
    }
  }

  const rejectWithdrawal = async (loanId: string) => {
    const note = wdRejectNote.trim()
    if (!note) {
      toast({ title: 'Note required', description: 'Add a short note for the rejection/refund.', variant: 'destructive' })
      return
    }
    if (!confirm('Reject this withdrawal & refund the downpayment? The loan will be closed.')) return
    setWdBusyId(loanId)
    try {
      await api('/api/admin/withdrawals', { method: 'PATCH', body: { id: loanId, action: 'reject', note } })
      toast({ title: 'Rejected & refunded', description: 'The loan has been closed and the user notified.' })
      setWdRejectingId(null)
      setWdRejectNote('')
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setWdBusyId(null)
    }
  }

  // ---- Loans ----
  const markLoanRepaid = async (loanId: string) => {
    if (!confirm('Mark this loan as fully repaid? All installments will be marked PAID.')) return
    try {
      await api('/api/admin/loans', { method: 'PATCH', body: { id: loanId, action: 'mark_repaid' } })
      toast({ title: 'Marked as repaid', description: 'The loan is now completed.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---- Users ----
  const userAction = async (u: any, action: string) => {
    try {
      await api('/api/admin/users', { method: 'PATCH', body: { id: u.id, action } })
      if (action === 'delete') {
        toast({ title: 'User deleted', description: 'Account removed from the database permanently.' })
      } else if (action === 'reset_kyc') {
        toast({ title: 'KYC reset', description: 'The user must resubmit their documents.' })
      } else {
        toast({ title: 'Done', description: `Action "${action}" applied.` })
      }
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---- Customer Videos ----
  const uploadVideo = async () => {
    if (!videoForm.file) return toast({ title: 'No video', description: 'Tap to choose a video first', variant: 'destructive' })
    if (!videoForm.title.trim()) return toast({ title: 'Title required', description: 'Add a title, e.g. "Ahsan from Lahore"', variant: 'destructive' })
    setVideoUploading(true)
    try {
      const adminToken = useAuth.getState().adminToken
      const fd = new FormData()
      fd.append('file', videoForm.file)
      fd.append('title', videoForm.title.trim())
      fd.append('subtitle', videoForm.subtitle.trim())
      const res = await fetch('/api/admin/videos', { method: 'POST', body: fd, headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      toast({ title: 'Video uploaded', description: 'It now appears under "Our Satisfied Customers" on the home page.' })
      setVideoForm({ title: '', subtitle: '', file: null })
      refresh()
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' })
    } finally {
      setVideoUploading(false)
    }
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('Delete this video? It will be removed from the home page.')) return
    try {
      await api(`/api/admin/videos?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Video deleted', description: 'The video has been removed.' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---- Bank / deposit accounts ----
  const saveBank = async () => {
    if (!bankForm.id && (!bankForm.method?.trim() || !bankForm.accountTitle?.trim() || !bankForm.accountNumber?.trim())) {
      toast({ title: 'Missing fields', description: 'Method, title and account number are required', variant: 'destructive' })
      return
    }
    setBankSaving(true)
    try {
      if (bankForm.id) {
        await api('/api/admin/bank-details', { method: 'PATCH', body: bankForm })
        toast({ title: 'Updated!', description: 'Bank account updated' })
      } else {
        await api('/api/admin/bank-details', { method: 'POST', body: bankForm })
        toast({ title: 'Added!', description: 'Bank account added' })
      }
      setBankForm({})
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBankSaving(false)
    }
  }

  const deleteBank = async (id: string) => {
    if (!confirm('Delete this bank account? Users will no longer see it.')) return
    try {
      await api('/api/admin/bank-details', { method: 'DELETE', body: { id } })
      toast({ title: 'Deleted', description: 'Bank account removed' })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const toggleBankActive = async (acc: any) => {
    try {
      await api('/api/admin/bank-details', { method: 'PATCH', body: { id: acc.id, isActive: !acc.isActive } })
      refresh()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---------- Computed lists ----------

  const matches = (u: any, q: string) => {
    if (!q) return true
    const s = q.toLowerCase()
    return (
      u.name?.toLowerCase().includes(s) ||
      u.phone?.includes(q) ||
      u.kyc?.fullName?.toLowerCase().includes(s) ||
      u.kyc?.cnic?.includes(q) ||
      u.kyc?.email?.toLowerCase().includes(s) ||
      u.kyc?.city?.toLowerCase().includes(s)
    )
  }

  // KYC cases (any user with a kyc record)
  const kycCases = users.filter((u: any) => u.kyc)
  const filteredKycCases = kycCases
    .filter((u: any) => (kycFilter === 'ALL' ? true : (u.kyc.kycStatus || 'PENDING') === kycFilter))
    .filter((u: any) => matches(u, kycSearch))

  // Unified payments list (downpayments + installments with proofs)
  const allPayments: any[] = [
    ...loans
      .filter((l: any) => l.downpaymentProof)
      .map((l: any) => ({
        key: `dp-${l.id}`,
        type: 'Down Payment',
        kind: 'DP' as const,
        id: l.id,
        amount: l.downpaymentAmount || 0,
        status: l.downpaymentStatus,
        submittedAt: l.downpaymentUploadedAt || l.updatedAt,
        reviewedAt: l.downpaymentReviewedAt,
        adminNote: l.downpaymentAdminNote,
        proof: l.downpaymentProof,
        user: l.user,
        loan: l,
      })),
    ...loans.flatMap((l: any) =>
      (l.installments || [])
        .filter((i: any) => i.proofImage)
        .map((i: any) => ({
          key: `inst-${i.id}`,
          type: `Installment #${i.installmentNumber}`,
          kind: 'INST' as const,
          id: i.id,
          amount: i.amount,
          status: i.status === 'PAID' ? 'APPROVED' : i.status,
          submittedAt: i.updatedAt,
          reviewedAt: i.paidAt,
          adminNote: null,
          proof: i.proofImage,
          user: l.user,
          loan: l,
        }))
    ),
  ]
  const filteredPayments = allPayments
    .filter((p: any) => (payFilter === 'ALL' ? true : p.status === payFilter))
    .filter((p: any) => {
      if (!paySearch) return true
      const q = paySearch.toLowerCase()
      return (
        p.user?.name?.toLowerCase().includes(q) ||
        p.user?.phone?.includes(q) ||
        p.user?.kyc?.cnic?.includes(q) ||
        String(p.amount).includes(q) ||
        p.status.toLowerCase().includes(q)
      )
    })

  // Withdrawals
  const filteredWithdrawals = withdrawals
    .filter((w: any) => (wdFilter === 'ALL' ? true : w.status === wdFilter))
    .filter((w: any) => {
      if (!wdSearch) return true
      const q = wdSearch.toLowerCase()
      return (
        w.user?.name?.toLowerCase().includes(q) ||
        w.user?.phone?.includes(q) ||
        w.user?.cnic?.includes(q) ||
        String(w.amount).includes(q)
      )
    })

  // Users
  const filteredUsers = users.filter((u: any) => matches(u, userSearch))

  // Loans
  const loanMatchesFilter = (l: any) => {
    switch (loanFilter) {
      case 'DP_PENDING':
        return l.status === 'DOWNPAYMENT_PENDING'
      case 'DP_APPROVED':
        return l.downpaymentStatus === 'APPROVED' && ['DOWNPAYMENT_APPROVED', 'FIRST_INSTALLMENT_PENDING'].includes(l.status)
      case 'INST1_APPROVED':
        return l.status === 'ACTIVE' && l.withdrawalStatus === 'PENDING'
      case 'WITHDRAWN':
        return l.withdrawalStatus === 'PAID'
      case 'REPAID':
        return l.status === 'COMPLETED'
      case 'REJECTED':
        return l.status === 'REJECTED' || (l.downpaymentStatus === 'REJECTED' && l.status !== 'ACTIVE')
      default:
        return true
    }
  }
  const filteredLoans = loans
    .filter(loanMatchesFilter)
    .filter((l: any) => {
      if (!loanSearch) return true
      const q = loanSearch.toLowerCase()
      return (
        l.user?.name?.toLowerCase().includes(q) ||
        l.user?.phone?.includes(q) ||
        l.user?.kyc?.cnic?.includes(q) ||
        String(l.amount).includes(q) ||
        l.status.toLowerCase().includes(q)
      )
    })

  const totalRepayable = (l: any) => l.weeklyInstallment * (l.totalInstallments || 4)
  const loanStatusLabel = (l: any) => {
    if (l.withdrawalStatus === 'PAID') return 'WITHDRAWN'
    if (l.status === 'COMPLETED') return 'REPAID'
    if (l.status === 'ACTIVE') return 'ACTIVE'
    if (l.status === 'FIRST_INSTALLMENT_PENDING') return 'DOWN PAYMENT APPROVED'
    if (l.status === 'DOWNPAYMENT_PENDING') return 'DOWN PAYMENT PENDING'
    if (l.status === 'REJECTED') return 'REJECTED'
    return l.status.replace(/_/g, ' ')
  }

  const badges = {
    kyc: stats.pendingKyc || 0,
    payments: stats.pendingPayments || 0,
    withdrawals: withdrawalCounts.pending || 0,
  }

  // Sidebar visibility: staff only see the modules their role allows;
  // super-only config sections are hidden from staff entirely. Fail-closed:
  // while the identity isn't confirmed, a session sees no admin sections at all.
  const SUPER_ONLY_TABS = ['videos', 'bank', 'staff', 'settings', 'logs']
  const MODULE_TABS: Array<{ id: string; perm: string }> = [
    { id: 'kyc', perm: 'kyc' },
    { id: 'payments', perm: 'payments' },
    { id: 'withdrawals', perm: 'withdrawals' },
    { id: 'users', perm: 'users' },
    { id: 'loans', perm: 'loans' },
  ]
  const isSuperAdmin = !!me && !me.isStaff
  const hiddenTabs: string[] = (() => {
    if (!isSuperAdmin) {
      // staff, blocked, expired, or auth still loading -> only assigned modules
      const restricted = [...SUPER_ONLY_TABS, ...MODULE_TABS.filter((t) => !me?.permissions?.[t.perm]).map((t) => t.id)]
      return me ? restricted : [...new Set([...SUPER_ONLY_TABS, ...MODULE_TABS.map((t) => t.id)])]
    }
    return []
  })()

  // ---------- Render ----------

  return (
    <AdminFrame activeTab={tab} onTabChange={(t) => setTab(t as Tab)} onRefresh={refresh} badges={badges} hiddenTabs={hiddenTabs} refreshing={refreshing}>
      {loading ? (
        <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Loading admin data…</div>
      ) : (
        <>
          {tab === 'overview' && <OverviewSection stats={stats} me={me} />}
          {tab === 'kyc' && (
            <KycSection
              cases={filteredKycCases}
              total={kycCases.length}
              filter={kycFilter}
              setFilter={setKycFilter}
              search={kycSearch}
              setSearch={setKycSearch}
              rejectingId={kycRejectingId}
              setRejectingId={setKycRejectingId}
              rejectNote={kycRejectNote}
              setRejectNote={setKycRejectNote}
              reasons={kycReasons}
              onAddReason={(r: string) => addRejectOption('kyc', r)}
              onRemoveReason={(r: string) => removeRejectOption('kyc', r)}
              onApprove={approveKyc}
              onReject={rejectKyc}
              onDelete={deleteKycCase}
            />
          )}
          {tab === 'payments' && (
            <PaymentsSection
              payments={filteredPayments}
              total={allPayments.length}
              filter={payFilter}
              setFilter={setPayFilter}
              search={paySearch}
              setSearch={setPaySearch}
              dpRejectingId={dpRejectingId}
              setDpRejectingId={setDpRejectingId}
              dpRejectNote={dpRejectNote}
              setDpRejectNote={setDpRejectNote}
              instRejectingId={instRejectingId}
              setInstRejectingId={setInstRejectingId}
              instRejectNote={instRejectNote}
              setInstRejectNote={setInstRejectNote}
              onApproveDp={approveDownpayment}
              onRejectDp={rejectDownpayment}
              onConfirmInst={confirmInstallment}
              onRejectInst={rejectInstallment}
              reasons={payReasons}
              onAddReason={(r: string) => addRejectOption('payment', r)}
              onRemoveReason={(r: string) => removeRejectOption('payment', r)}
            />
          )}
          {tab === 'withdrawals' && (
            <WithdrawalsSection
              items={filteredWithdrawals}
              counts={withdrawalCounts}
              filter={wdFilter}
              setFilter={setWdFilter}
              search={wdSearch}
              setSearch={setWdSearch}
              txnIds={wdTxnIds}
              setTxnIds={setWdTxnIds}
              busyId={wdBusyId}
              rejectingId={wdRejectingId}
              setRejectingId={setWdRejectingId}
              rejectNote={wdRejectNote}
              setRejectNote={setWdRejectNote}
              onMarkPaid={markWithdrawalPaid}
              onReject={rejectWithdrawal}
            />
          )}
          {tab === 'users' && (
            <UsersSection users={filteredUsers} total={users.length} search={userSearch} setSearch={setUserSearch} onAction={userAction} />
          )}
          {tab === 'loans' && (
            <LoansSection
              loans={filteredLoans}
              total={loans.length}
              filter={loanFilter}
              setFilter={setLoanFilter}
              search={loanSearch}
              setSearch={setLoanSearch}
              onMarkRepaid={markLoanRepaid}
              totalRepayable={totalRepayable}
              statusLabel={loanStatusLabel}
            />
          )}
          {isSuperAdmin && tab === 'videos' && (
            <VideosSection
              videos={videos}
              form={videoForm}
              setForm={setVideoForm}
              uploading={videoUploading}
              onUpload={uploadVideo}
              onDelete={deleteVideo}
            />
          )}
          {isSuperAdmin && tab === 'bank' && (
            <BankSection
              accounts={bankAccounts}
              form={bankForm}
              setForm={setBankForm}
              saving={bankSaving}
              onSave={saveBank}
              onDelete={deleteBank}
              onToggleActive={toggleBankActive}
            />
          )}
          {isSuperAdmin && tab === 'settings' && (
            <SettingsSection
              appInfo={appInfo}
              appBusy={appBusy}
              onUploadApp={uploadApp}
              onDeleteApp={deleteApp}
              smsOtpEnabled={smsOtpEnabled}
              smsToggleLoading={smsToggleLoading}
              onToggleSms={toggleSmsOtp}
              referralBonus={referralBonus}
              setReferralBonus={setReferralBonus}
              downpaymentPct={downpaymentPct}
              setDownpaymentPct={setDownpaymentPct}
              markupPct={markupPct}
              setMarkupPct={setMarkupPct}
              loyaltyReducePct={loyaltyReducePct}
              setLoyaltyReducePct={setLoyaltyReducePct}
              loyaltyMinMarkupPct={loyaltyMinMarkupPct}
              setLoyaltyMinMarkupPct={setLoyaltyMinMarkupPct}
              loanPackages={loanPackages}
              setLoanPackages={setLoanPackages}
              tawkEnabled={tawkEnabled}
              setTawkEnabled={setTawkEnabled}
              tawkWidgetId={tawkWidgetId}
              setTawkWidgetId={setTawkWidgetId}
              smsApi={smsApi}
              setSmsApi={setSmsApi}
              saving={settingsSaving}
              onSave={saveSettings}
              pwCurrent={pwCurrent}
              setPwCurrent={setPwCurrent}
              pwNew={pwNew}
              setPwNew={setPwNew}
              pwConfirm={pwConfirm}
              setPwConfirm={setPwConfirm}
              pwChanging={pwChanging}
              onChangePassword={changeAdminPassword}
            />
          )}
          {isSuperAdmin && tab === 'staff' && <StaffSection />}
          {isSuperAdmin && tab === 'logs' && <LogsTab />}
        </>
      )}
      {notifPopups.length > 0 && (
        <NotifPopup
          items={notifPopups}
          onGo={(t: Tab) => {
            setTab(t)
            dismissPopups()
          }}
          onClose={dismissPopups}
        />
      )}
    </AdminFrame>
  )
}

// ================= New-activity pop-up (super admin & staff) =================

function NotifPopup({
  items,
  onGo,
  onClose,
}: {
  items: Array<{ label: string; count: number; tab: Tab }>
  onGo: (tab: Tab) => void
  onClose: () => void
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[min(94vw,420px)] animate-in slide-in-from-top-4 fade-in duration-200">
      <div className="bg-slate-900/95 backdrop-blur border border-amber-400/40 rounded-2xl shadow-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-slate-900" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">New activity</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tap a section to open it</p>
            <div className="mt-2 space-y-1">
              {items.map((it) => (
                <button
                  key={it.tab}
                  onClick={() => onGo(it.tab)}
                  className="w-full text-left flex items-center justify-between gap-2 text-xs text-slate-200 hover:text-white rounded-lg px-2 py-1.5 hover:bg-white/10 transition-colors"
                >
                  <span>
                    <span className="font-bold text-amber-300">{it.count}</span> new {it.label}
                    {it.count > 1 ? 's' : ''}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Dismiss notifications pop-up"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ================= Shared bits =================

function PageHeader({ icon: Icon, title, desc, accent = 'bg-emerald-600' }: { icon: any; title: string; desc: string; accent?: string }) {
  return (
    <div className="pt-6 pb-4">
      <div className="flex items-start gap-3">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm', accent)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="h-1 w-16 bg-amber-400 rounded-full mt-3 ml-[60px]" />
    </div>
  )
}

function FilterChip({ active, children, onClick, tone = 'emerald' }: { active: boolean; children: React.ReactNode; onClick: () => void; tone?: 'emerald' | 'slate' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap',
        active
          ? tone === 'emerald'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-slate-800 text-white border-slate-800 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
      )}
    >
      {children}
    </button>
  )
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-10 h-11 rounded-xl bg-white border-slate-200" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'copied' : 'copy'}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
    PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    WITHDRAWN: 'bg-teal-100 text-teal-800 border-teal-200',
    REPAID: 'bg-sky-100 text-sky-800 border-sky-200',
    ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wide', map[status] || 'bg-slate-100 text-slate-700 border-slate-200')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-14">
      <div className="flex justify-center mb-3 text-slate-300">{icon}</div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB')} , ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB')
}

// ================= Overview =================

const MODULE_LABELS: Record<string, string> = {
  users: 'Users',
  payments: 'Payments',
  loans: 'Loans',
  withdrawals: 'Withdrawals',
  kyc: 'KYC Review',
}

function OverviewSection({ stats, me }: { stats: any; me: any }) {
  const isStaff = !!me?.isStaff
  const can = (mod: string) => !isStaff || !!me?.permissions?.[mod]

  // Permission-aware cards: staff only see the numbers of their own modules
  // (the API scopes the payload too — this is presentation-level matching).
  const cards: Array<{ icon: any; label: string; value: number; accent: string; money?: boolean }> = []
  if (can('users')) cards.push({ icon: Users, label: 'Total Users', value: stats.totalUsers ?? 0, accent: 'bg-emerald-500' })
  if (can('kyc')) cards.push({ icon: ShieldCheck, label: 'Pending KYC', value: stats.pendingKyc ?? 0, accent: 'bg-amber-500' })
  if (can('loans')) cards.push({ icon: ListChecks, label: 'Total Loans', value: stats.totalLoans ?? 0, accent: 'bg-teal-500' })
  if (can('payments')) {
    cards.push({ icon: Clock, label: 'Pending Approvals', value: stats.pendingApprovals ?? 0, accent: 'bg-amber-500' })
    cards.push({ icon: CheckCircle2, label: 'Approved Payments', value: stats.approvedPayments ?? 0, accent: 'bg-emerald-600' })
    cards.push({ icon: XCircle, label: 'Rejected Payments', value: stats.rejectedPayments ?? 0, accent: 'bg-red-500' })
    cards.push({ icon: ArrowUpFromLine, label: 'Total Received', value: stats.totalReceived ?? 0, accent: 'bg-slate-800', money: true })
  }
  if (can('loans')) cards.push({ icon: ArrowDownToLine, label: 'Total Disbursed', value: stats.totalDisbursed ?? 0, accent: 'bg-slate-800', money: true })

  const miniStats: Array<{ label: string; value: number; tone: string }> = []
  if (can('loans')) {
    miniStats.push({ label: 'Active Loans', value: stats.activeLoans ?? 0, tone: 'text-emerald-600' })
    miniStats.push({ label: 'Completed (Repaid)', value: stats.completedLoans ?? 0, tone: 'text-sky-600' })
  }
  if (can('withdrawals')) miniStats.push({ label: 'Pending Withdrawals', value: stats.pendingWithdrawals ?? 0, tone: 'text-amber-600' })

  const staffModules = isStaff
    ? Object.keys(MODULE_LABELS).filter((m) => me?.permissions?.[m])
    : []

  return (
    <div>
      <PageHeader icon={LayoutGrid} title="Dashboard" desc={isStaff ? 'Quick overview of your assigned modules' : 'Quick overview of platform activity'} />
      {isStaff && staffModules.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-12 h-12" />}
          title="No modules assigned"
          subtitle="Your role has no module permissions yet. Ask the super admin to update your role in Staff & Roles."
        />
      ) : (
        <>
          <div className="grid grid-cols-3  gap-4 pb-6">
            {cards.map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', c.accent)}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-slate-900 leading-tight">
                  {c.money ? `PKR ${Number(c.value).toLocaleString()}` : Number(c.value).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {isStaff ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Your access</h3>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {staffModules.map((m) => (
                  <span key={m} className="text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-1">
                    {MODULE_LABELS[m]}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                These numbers cover only the modules assigned to your role{me?.roleName ? ` (${me.roleName})` : ''}. Sections you
                do not manage are hidden from the sidebar and their data stays out of your view.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-bold text-slate-800 mb-3">How the approval flow works</h3>
              <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
                <li>User registers &amp; submits KYC — you review it in the KYC Review tab.</li>
                <li>User selects a loan package &amp; enters their withdrawal account details.</li>
                <li>System requires a security down payment — user uploads the receipt screenshot — it appears in Payments as PENDING.</li>
                <li>You approve the downpayment, user uploads the 1st installment proof, and you confirm it in Payments.</li>
                <li>Withdrawal unlocks — the request appears in Withdrawals — send the money, then record the Transaction ID.</li>
                <li>User pays weekly installments; when all are confirmed the loan is automatically REPAID.</li>
              </ol>
            </div>
          )}

          {miniStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
              {miniStats.map((m) => (
                <MiniStat key={m.label} label={m.label} value={m.value} tone={m.tone} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={cn('text-lg font-bold', tone)}>{Number(value).toLocaleString()}</span>
    </div>
  )
}

// ================= KYC Review =================

function KycSection({
  cases,
  total,
  filter,
  setFilter,
  search,
  setSearch,
  rejectingId,
  setRejectingId,
  rejectNote,
  setRejectNote,
  reasons,
  onAddReason,
  onRemoveReason,
  onApprove,
  onReject,
  onDelete,
}: any) {
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  return (
    <div>
      <PageHeader icon={ShieldCheck} title="KYC Review" desc="Verify identity documents, request resubmission, or remove wrong accounts" />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as KycFilter[]).map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)} tone={f === 'ALL' ? 'slate' : 'emerald'}>
              {f === 'ALL' ? 'All Cases (History)' : f.charAt(0) + f.slice(1).toLowerCase()}
            </FilterChip>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">{total.toLocaleString()} total cases</span>
      </div>
      <div className="mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone, CNIC, email, DOB, address, status..." />
      </div>

      {cases.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="w-12 h-12" />} title="No KYC cases here" subtitle="Cases submitted by users will appear in this list." />
      ) : (
        <InfiniteList
          items={cases}
          chunk={6}
          className="grid grid-cols-1 gap-4 pb-8"
          render={(u: any) => {
            const k = u.kyc
            const status = k.kycStatus || 'PENDING'
            const isPending = status === 'PENDING'
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{k.fullName || u.name || 'Unnamed'}</h3>
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {k.cnic || '—'} · submitted {fmtDateTime(k.createdAt)}
                      {k.kycReviewedAt && <> · reviewed {fmtDateTime(k.kycReviewedAt)}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(u.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete case
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { src: k.cnicFrontImage, label: 'CNIC Front' },
                    { src: k.cnicBackImage, label: 'CNIC Back' },
                    { src: k.selfieImage, label: 'Selfie' },
                  ].map((img) => (
                    <div key={img.label} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[4/3] group">
                      {img.src ? (
                        <button type="button" onClick={() => setImgPreview(img.src)} className="block w-full h-full cursor-zoom-in" title="View full size">
                          <img src={img.src} alt={img.label} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                        </button>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">{img.label}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-xs mb-3">
                  <p className="text-slate-500">CNIC: <span className="font-semibold text-slate-800">{k.cnic || '—'}</span></p>
                  <p className="text-slate-500">Date of Birth: <span className="font-semibold text-slate-800">{k.dob || '—'}</span></p>
                  <p className="text-slate-500">Phone: <span className="font-semibold text-slate-800">{u.phone}</span></p>
                  <p className="text-slate-500">Email: <span className="font-semibold text-slate-800">{k.email || '—'}</span></p>
                  <p className="text-slate-500">City: <span className="font-semibold text-slate-800">{k.city || '—'}</span></p>
                  <p className="text-slate-500">Address: <span className="font-semibold text-slate-800">{k.address || '—'}</span></p>
                  <p className="text-slate-500">Occupation: <span className="font-semibold text-slate-800">{k.occupation}{k.employerName ? ` (${k.employerName})` : ''}</span></p>
                  <p className="text-slate-500">Monthly Income: <span className="font-semibold text-slate-800">PKR {Number(k.monthlyIncome || 0).toLocaleString()}</span></p>
                </div>

                {k.kycAdminNote && (
                  <div className={cn('rounded-xl px-4 py-2.5 text-xs mb-3', status === 'REJECTED' ? 'bg-red-50 text-red-700 italic' : 'bg-slate-50 text-slate-600 italic')}>
                    Note: {k.kycAdminNote}
                  </div>
                )}

                {isPending && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button onClick={() => onApprove(u.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve KYC
                    </Button>
                    <Button
                      onClick={() => {
                        setRejectingId(rejectingId === u.id ? null : u.id)
                        setRejectNote('')
                      }}
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 h-9 rounded-xl text-xs font-semibold"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}

                {isPending && rejectingId === u.id && (
                  <RejectReasonPicker
                    reasons={reasons}
                    note={rejectNote}
                    onNoteChange={setRejectNote}
                    canRemove={(r: string) => !KYC_REJECT_REASONS.includes(r)}
                    onAdd={onAddReason}
                    onRemove={onRemoveReason}
                    onConfirm={(r: string) => onReject(u.id, r)}
                  />
                )}
              </div>
            )
          }}
        />
      )}

      {imgPreview && <ImageLightbox src={imgPreview} onClose={() => setImgPreview(null)} />}
    </div>
  )
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <img src={src} alt="Document preview" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Close preview">
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

// ================= Payments =================

function PaymentsSection({
  payments,
  total,
  filter,
  setFilter,
  search,
  setSearch,
  dpRejectingId,
  setDpRejectingId,
  dpRejectNote,
  setDpRejectNote,
  instRejectingId,
  setInstRejectingId,
  instRejectNote,
  setInstRejectNote,
  onApproveDp,
  onRejectDp,
  onConfirmInst,
  onRejectInst,
  reasons,
  onAddReason,
  onRemoveReason,
}: any) {
  const [preview, setPreview] = useState<string | null>(null)
  return (
    <div>
      <PageHeader icon={Banknote} title="Payment Approvals" desc="Review user-submitted payment screenshots" />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as PayFilter[]).map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)} tone={f === 'ALL' ? 'slate' : 'emerald'}>
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </FilterChip>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">{total.toLocaleString()} total payments</span>
      </div>
      <div className="mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone, CNIC, amount, status..." />
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={<Banknote className="w-12 h-12" />} title="No payments in this view" subtitle="Downpayment and installment receipts submitted by users appear here." />
      ) : (
        <InfiniteList
          items={payments}
          chunk={6}
          className="space-y-4 pb-8"
          render={(p: any) => {
            const isPending = p.status === 'PENDING'
            const isDp = p.kind === 'DP'
            const isDpRejecting = isDp && dpRejectingId === p.id
            const isInstRejecting = !isDp && instRejectingId === p.id
            return (
              <div key={p.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="sm:w-52 shrink-0">
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[4/3] group">
                      <button type="button" onClick={() => setPreview(p.proof)} className="block w-full h-full cursor-zoom-in" title="View full size">
                        <img src={p.proof} alt="Payment proof" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={p.status} />
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-600 border-slate-200">
                        {p.type}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">PKR {Number(p.amount).toLocaleString()}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      User: <span className="font-semibold text-slate-700">{p.user?.name || 'Unnamed'}</span>
                      {p.user?.kyc?.cnic && <> · CNIC: <span className="font-semibold text-slate-700">{p.user.kyc.cnic}</span></>}
                    </p>
                    <p className="text-xs text-slate-500">Phone: {p.user?.phone} · Submitted: {fmtDateTime(p.submittedAt)}</p>
                    {p.adminNote && <p className="text-xs text-slate-500 mt-1">Admin note: <span className="italic">{p.adminNote}</span></p>}
                    {p.reviewedAt && <p className="text-xs text-slate-400">Reviewed: {fmtDateTime(p.reviewedAt)}</p>}

                    {isPending && (
                      <div className="flex items-center gap-2 flex-wrap mt-3">
                        {isDp ? (
                          <>
                            <Button onClick={() => onApproveDp(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              onClick={() => {
                                setDpRejectingId(dpRejectingId === p.id ? null : p.id)
                                setDpRejectNote('')
                              }}
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 h-9 rounded-xl text-xs font-semibold"
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button onClick={() => onConfirmInst(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm paid
                            </Button>
                            <Button
                              onClick={() => {
                                setInstRejectingId(instRejectingId === p.id ? null : p.id)
                                setInstRejectNote('')
                              }}
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 h-9 rounded-xl text-xs font-semibold"
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {isDpRejecting && (
                      <RejectReasonPicker
                        reasons={reasons}
                        note={dpRejectNote}
                        onNoteChange={setDpRejectNote}
                        canRemove={(r: string) => !PAYMENT_REJECT_REASONS.includes(r)}
                        onAdd={onAddReason}
                        onRemove={onRemoveReason}
                        onConfirm={(r: string) => onRejectDp(p.id, r)}
                      />
                    )}
                    {isInstRejecting && (
                      <RejectReasonPicker
                        reasons={reasons}
                        note={instRejectNote}
                        onNoteChange={setInstRejectNote}
                        canRemove={(r: string) => !PAYMENT_REJECT_REASONS.includes(r)}
                        onAdd={onAddReason}
                        onRemove={onRemoveReason}
                        onConfirm={(r: string) => onRejectInst(p.id, r)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          }}
        />
      )}
      {preview && <ImageLightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ================= Rejection reason picker (KYC + Payments) =================

// Shared rejection panel with admin-manageable options. No dropdown, no
// separate confirm step: reasons are quick chips — tapping one rejects
// immediately (guarded by a native confirm). "＋ Add Option" appends a custom
// reason (persisted for the whole team); custom chips carry a small × so the
// team can prune the list inline. "Other" opens a note box for free text.
function RejectReasonPicker({
  reasons,
  note,
  onNoteChange,
  canRemove,
  onAdd,
  onRemove,
  onConfirm,
}: {
  reasons: string[]
  note: string
  onNoteChange: (v: string) => void
  canRemove: (reason: string) => boolean
  onAdd: (reason: string) => Promise<boolean>
  onRemove: (reason: string) => Promise<boolean>
  onConfirm: (finalReason: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [otherMode, setOtherMode] = useState(false)
  const [busy, setBusy] = useState(false)

  const submitAdd = async () => {
    if (busy || !draft.trim()) return
    setBusy(true)
    const ok = await onAdd(draft)
    setBusy(false)
    if (ok) {
      setDraft('')
      setAdding(false)
    }
  }

  const tapReason = (reason: string) => {
    if (reason === 'Other') {
      setOtherMode(true)
      return
    }
    setOtherMode(false)
    if (confirm(`Reject with "${reason}"?`)) onConfirm(reason)
  }

  const submitOther = () => {
    const text = note.trim()
    if (text) onConfirm(text)
  }

  return (
    <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold text-red-700">Tap a reason to reject:</p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={cn(
            'text-[10px] font-bold rounded-md px-2 py-1 inline-flex items-center gap-1 border transition-colors',
            adding ? 'bg-emerald-600 text-white border-emerald-600' : 'text-emerald-700 bg-white border-emerald-200 hover:bg-emerald-50'
          )}
        >
          <Plus className="w-3 h-3" /> Add Option
        </button>
      </div>

      {adding && (
        <div className="flex gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            placeholder="Type a new custom reason…"
            maxLength={120}
            className="bg-white h-8 text-xs rounded-md"
            autoFocus
            disabled={busy}
          />
          <Button onClick={submitAdd} disabled={busy || !draft.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-[11px] px-3 rounded-md shrink-0">
            {busy ? 'Saving…' : 'Add'}
          </Button>
          <Button variant="outline" onClick={() => { setAdding(false); setDraft('') }} className="h-8 text-[11px] px-3 rounded-md shrink-0">
            Cancel
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <span key={r} className="inline-flex items-stretch overflow-hidden rounded-full border border-red-200 bg-white">
            <button
              type="button"
              onClick={() => tapReason(r)}
              className={cn(
                'text-[11px] font-semibold px-3 py-1.5 transition-colors',
                r === 'Other' ? 'text-slate-600 hover:bg-slate-800 hover:text-white' : 'text-red-700 hover:bg-red-600 hover:text-white'
              )}
            >
              {r}
            </button>
            {canRemove(r) && (
              <button
                type="button"
                onClick={() => onRemove(r)}
                title={`Remove "${r}"`}
                className="w-6 flex items-center justify-center text-red-300 hover:bg-red-500 hover:text-white border-l border-red-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {reasons.some((r) => canRemove(r)) && (
        <p className="text-[10px] text-red-400">Tap × next to a custom option to remove it for the whole team.</p>
      )}

      {otherMode && (
        <div className="space-y-1.5">
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Write the reason..."
            className="bg-white text-xs min-h-[60px]"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button onClick={submitOther} disabled={!note.trim()} className="bg-red-600 hover:bg-red-700 text-white h-7 text-[11px] px-3 rounded-md">
              Reject with this reason
            </Button>
            <button type="button" onClick={() => setOtherMode(false)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ================= Staff & Roles (super admin) =================

const STAFF_MODULES = [
  { key: 'canKyc', label: 'KYC Review' },
  { key: 'canPayments', label: 'Payments' },
  { key: 'canWithdrawals', label: 'Withdrawals' },
  { key: 'canUsers', label: 'Users' },
  { key: 'canLoans', label: 'Loans' },
] as const

function StaffSection() {
  const { toast } = useToast()
  const [roles, setRoles] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // role editor: null = closed, 'new' = creating, object = editing
  const [editingRole, setEditingRole] = useState<any>(null)
  const [roleName, setRoleName] = useState('')
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({})
  const [roleSaving, setRoleSaving] = useState(false)

  // staff create form
  const [staffForm, setStaffForm] = useState({ username: '', password: '', roleId: '' })
  const [staffSaving, setStaffSaving] = useState(false)

  const load = () => {
    Promise.all([api('/api/admin/roles'), api('/api/admin/staff')])
      .then(([r, s]) => {
        setRoles(r.roles || [])
        setStaff(s.staff || [])
      })
      .catch((e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNewRole = () => {
    setEditingRole('new')
    setRoleName('')
    setRolePerms({})
  }

  const openEditRole = (r: any) => {
    setEditingRole(r)
    setRoleName(r.name)
    setRolePerms({ canUsers: r.canUsers, canPayments: r.canPayments, canLoans: r.canLoans, canWithdrawals: r.canWithdrawals, canKyc: r.canKyc })
  }

  const saveRole = async () => {
    if (!roleName.trim()) {
      toast({ title: 'Missing name', description: 'Give the role a name, e.g. "KYC Officer".', variant: 'destructive' })
      return
    }
    if (!Object.values(rolePerms).some(Boolean)) {
      toast({ title: 'No permissions selected', description: 'Pick at least one module this role can manage.', variant: 'destructive' })
      return
    }
    setRoleSaving(true)
    try {
      const action = editingRole === 'new' ? 'create' : 'update'
      await api('/api/admin/roles', {
        method: 'POST',
        body: { action, id: editingRole === 'new' ? undefined : editingRole.id, name: roleName.trim(), ...rolePerms },
      })
      toast({ title: editingRole === 'new' ? 'Role created' : 'Role updated', description: `"${roleName.trim()}" saved successfully.` })
      setEditingRole(null)
      load()
    } catch (e: any) {
      toast({ title: 'Could not save role', description: e.message, variant: 'destructive' })
    } finally {
      setRoleSaving(false)
    }
  }

  const deleteRole = async (r: any) => {
    if (!confirm(`Delete role "${r.name}"?`)) return
    try {
      await api('/api/admin/roles', { method: 'POST', body: { action: 'delete', id: r.id } })
      toast({ title: 'Role deleted', description: `"${r.name}" has been removed.` })
      load()
    } catch (e: any) {
      toast({ title: 'Could not delete role', description: e.message, variant: 'destructive' })
    }
  }

  const createStaff = async () => {
    if (!staffForm.username.trim() || !staffForm.password || !staffForm.roleId) {
      toast({ title: 'Missing fields', description: 'Username, password and role are required.', variant: 'destructive' })
      return
    }
    setStaffSaving(true)
    try {
      await api('/api/admin/staff', { method: 'POST', body: { action: 'create', ...staffForm } })
      toast({ title: 'Staff account created', description: `${staffForm.username.trim()} can now log in with their role access.` })
      setStaffForm({ username: '', password: '', roleId: '' })
      load()
    } catch (e: any) {
      toast({ title: 'Could not create staff', description: e.message, variant: 'destructive' })
    } finally {
      setStaffSaving(false)
    }
  }

  const toggleBlockStaff = async (s: any) => {
    try {
      await api('/api/admin/staff', { method: 'POST', body: { action: 'update', id: s.id, blocked: !s.blocked } })
      toast({ title: s.blocked ? 'Staff unblocked' : 'Staff blocked', description: `${s.username} was ${s.blocked ? 'given' : 'denied'} console access.` })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const resetStaffPassword = async (s: any) => {
    const pw = prompt(`New password for "${s.username}" (min 6 characters):`)
    if (pw === null) return
    if (pw.length < 6) {
      toast({ title: 'Too short', description: 'Password must be at least 6 characters.', variant: 'destructive' })
      return
    }
    try {
      await api('/api/admin/staff', { method: 'POST', body: { action: 'reset_password', id: s.id, password: pw } })
      toast({ title: 'Password reset', description: `${s.username} can now log in with the new password.` })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const deleteStaff = async (s: any) => {
    if (!confirm(`Delete staff account "${s.username}"? This cannot be undone.`)) return
    try {
      await api('/api/admin/staff', { method: 'POST', body: { action: 'delete', id: s.id } })
      toast({ title: 'Staff deleted', description: `${s.username}'s access has been revoked.` })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div>
      <PageHeader icon={UserCog} title="Staff & Roles" desc="Create roles for staff and control which modules they can manage" />

      {loading ? (
        <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Loading staff data…</div>
      ) : (
        <div className="space-y-6 pb-8">
          {/* ------- Roles ------- */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Roles</h3>
                <p className="text-xs text-slate-500">Each role toggles which modules staff assigned to it can open and act in.</p>
              </div>
              <Button onClick={openNewRole} disabled={editingRole !== null} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-semibold shrink-0">
                <Plus className="w-4 h-4 mr-1" /> New Role
              </Button>
            </div>

            {editingRole !== null && (
              <div className="mb-4 bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-800">{editingRole === 'new' ? 'Create a new role' : `Edit role: ${editingRole.name}`}</p>
                <div className="sm:max-w-xs">
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">Role name</Label>
                  <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. KYC Officer" maxLength={32} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Can manage</Label>
                  <div className="flex gap-2 flex-wrap">
                    {STAFF_MODULES.map((m) => {
                      const active = !!rolePerms[m.key]
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setRolePerms((p) => ({ ...p, [m.key]: !p[m.key] }))}
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors',
                            active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                          )}
                        >
                          {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveRole} disabled={roleSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-semibold">
                    {roleSaving ? 'Saving…' : editingRole === 'new' ? 'Create role' : 'Save changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingRole(null)} className="h-9 rounded-xl text-xs font-semibold">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {roles.length === 0 ? (
              <EmptyState icon={<UserCog className="w-12 h-12" />} title="No roles yet" subtitle={'Create a role like "KYC Officer" and assign staff to it.'} />
            ) : (
              <div className="space-y-2">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        {r.name}
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                          {r.staffCount} staff
                        </span>
                      </p>
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {STAFF_MODULES.filter((m) => r[m.key]).map((m) => (
                          <span key={m.key} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                            {m.label}
                          </span>
                        ))}
                        {!STAFF_MODULES.some((m) => r[m.key]) && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">No permissions</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" onClick={() => openEditRole(r)} className="h-8 rounded-lg text-xs font-semibold px-3">Edit</Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteRole(r)}
                        disabled={r.staffCount > 0}
                        title={r.staffCount > 0 ? 'Reassign or delete the staff using this role first' : 'Delete role'}
                        className="h-8 rounded-lg text-xs font-semibold px-3 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ------- Staff accounts ------- */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800">Staff accounts</h3>
            <p className="text-xs text-slate-500 mb-4">Staff log in through the same admin console with a username and password.</p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 mb-5 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Input
                value={staffForm.username}
                onChange={(e) => setStaffForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="username (e.g. kyc_officer)"
                className="h-9 text-xs bg-white"
                maxLength={24}
              />
              <Input
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="password (min 6 chars)"
                className="h-9 text-xs bg-white"
              />
              <Select value={staffForm.roleId} onValueChange={(v) => setStaffForm((f) => ({ ...f, roleId: v }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg sm:w-44"><SelectValue placeholder="Assign role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createStaff} disabled={staffSaving} className="bg-slate-900 hover:bg-slate-800 text-white h-9 rounded-lg text-xs font-semibold">
                {staffSaving ? 'Creating…' : 'Add staff'}
              </Button>
            </div>

            {staff.length === 0 ? (
              <EmptyState icon={<Users className="w-12 h-12" />} title="No staff accounts yet" subtitle="Create a role above, then add a staff account and share the credentials." />
            ) : (
              <div className="space-y-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white grid place-items-center text-sm font-bold shrink-0">
                        {s.username?.[0]?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                          {s.username}
                          <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full px-2 py-0.5">{s.roleName}</span>
                          {s.blocked && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">BLOCKED</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">Created {fmtDateTime(s.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap shrink-0">
                      <Button variant="outline" onClick={() => toggleBlockStaff(s)} className="h-8 rounded-lg text-xs font-semibold px-2.5">
                        {s.blocked ? 'Unblock' : 'Block'}
                      </Button>
                      <Button variant="outline" onClick={() => resetStaffPassword(s)} className="h-8 rounded-lg text-xs font-semibold px-2.5">Reset PW</Button>
                      <Button variant="outline" onClick={() => deleteStaff(s)} className="h-8 rounded-lg text-xs font-semibold px-2.5 border-red-200 text-red-600 hover:bg-red-50">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ================= Withdrawals =================

function WithdrawalsSection({
  items,
  counts,
  filter,
  setFilter,
  search,
  setSearch,
  txnIds,
  setTxnIds,
  busyId,
  rejectingId,
  setRejectingId,
  rejectNote,
  setRejectNote,
  onMarkPaid,
  onReject,
}: any) {
  return (
    <div>
      <PageHeader icon={Wallet} title="Withdrawals" desc="Send the money to the user's account, then record the Transaction ID" />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['PENDING', 'PAID', 'REJECTED', 'ALL'] as WdFilter[]).map((f) => (
            <FilterChip
              key={f}
              active={filter === f}
              onClick={() => setFilter(f)}
              tone={f === 'ALL' ? 'slate' : 'emerald'}
            >
              {f === 'PENDING' ? `Pending${counts?.pending ? ` (${counts.pending})` : ''}` : f.charAt(0) + f.slice(1).toLowerCase()}
            </FilterChip>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium">{(counts?.all || 0).toLocaleString()} total requests</span>
      </div>
      <div className="mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone, CNIC, amount..." />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Wallet className="w-12 h-12" />} title="No withdrawal requests here" subtitle="Once a loan's first installment is confirmed, the disbursement request appears here." />
      ) : (
        <InfiniteList
          items={items}
          chunk={6}
          className="space-y-4 pb-8"
          render={(w: any) => {
            const isPending = w.status === 'PENDING'
            return (
              <div key={w.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-col lg:flex-row gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={w.status} />
                      {w.method && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-600 border-slate-200">{w.method}</span>}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">PKR {Number(w.amount).toLocaleString()}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      User: <span className="font-semibold text-slate-700">{w.user?.name || 'Unnamed'}</span>
                      {w.user?.cnic && <> · CNIC: <span className="font-semibold text-slate-700">{w.user.cnic}</span></>}
                    </p>
                    <p className="text-xs text-slate-500">Phone: {w.user?.phone} · Requested: {fmtDateTime(w.requestedAt)}</p>

                    <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 max-w-md">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Send to</span>
                        <span className="font-bold text-slate-800">{w.method || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-500">Account #</span>
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{w.accountNumber || '—'}</span>
                          {w.accountNumber && <CopyBtn text={w.accountNumber} />}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-500">Account title</span>
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{w.accountTitle || '—'}</span>
                          {w.accountTitle && <CopyBtn text={w.accountTitle} />}
                        </span>
                      </div>
                      {w.bank && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Bank</span>
                          <span className="font-bold text-slate-800">{w.bank}</span>
                        </div>
                      )}
                    </div>

                    {!isPending && (
                      <div className="mt-3 space-y-1 text-xs">
                        {w.txnId && <p className="text-emerald-700 font-semibold">Transaction ID: {w.txnId}</p>}
                        {w.adminNote && <p className="text-slate-500 italic">Note: {w.adminNote}</p>}
                        {w.reviewedAt && <p className="text-slate-400">{w.status === 'PAID' ? 'Paid' : 'Rejected'}: {fmtDateTime(w.reviewedAt)}</p>}
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div className="lg:w-72 shrink-0 space-y-2">
                      <label className="text-xs font-bold text-slate-700">Transaction ID (after sending money)</label>
                      <Input
                        value={txnIds[w.id] || ''}
                        onChange={(e) => setTxnIds({ ...txnIds, [w.id]: e.target.value })}
                        placeholder="e.g. TXN123456 / TID from app"
                        className="h-10 rounded-xl text-xs"
                      />
                      <Button
                        onClick={() => onMarkPaid(w.id)}
                        disabled={busyId === w.id}
                        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> {busyId === w.id ? 'Saving…' : 'Mark Paid & Send ID'}
                      </Button>
                      <Button
                        onClick={() => {
                          setRejectingId(rejectingId === w.id ? null : w.id)
                          setRejectNote('')
                        }}
                        variant="outline"
                        className="w-full h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> Reject &amp; Refund
                      </Button>
                      {rejectingId === w.id && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                          <Textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Rejection / refund note for the user..."
                            className="bg-white text-xs min-h-[60px]"
                          />
                          <Button onClick={() => onReject(w.id)} disabled={busyId === w.id} className="w-full h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs">
                            Confirm reject &amp; refund
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

// ================= Users =================

function UsersSection({ users, total, search, setSearch, onAction }: any) {
  const { visible: rowCount, hasMore, loadMore } = useChunked(users.length, 20)
  return (
    <div>
      <PageHeader icon={Users} title="Users" desc="Manage user accounts, KYC resets, and wrong approvals" />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex-1 min-w-[260px] max-w-xl">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, CNIC, email, status..." />
        </div>
        <span className="text-xs text-slate-500 font-medium">{total.toLocaleString()} total users</span>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<Users className="w-12 h-12" />} title="No users found" subtitle="Try a different search." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto mb-8">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">CNIC</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">KYC</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wallet</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Withdraw</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, rowCount).map((u: any) => {
                const activeLoan = (u.loans || []).find((l: any) => !['COMPLETED', 'REJECTED'].includes(l.status))
                const wallet = activeLoan ? (activeLoan.withdrawalStatus === 'PAID' ? activeLoan.amount : 0) : 0
                const unlocked = !!activeLoan?.withdrawalUnlocked
                const kycStatus = u.kyc?.kycStatus || null
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">{u.name || u.kyc?.fullName || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500">{u.phone}</p>
                      {u.blocked && <span className="text-[10px] font-bold text-red-500">BLOCKED</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{u.kyc?.cnic || '—'}</td>
                    <td className="px-4 py-3">
                      {kycStatus ? (
                        <StatusBadge status={kycStatus} />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200">NOT SUBMITTED</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-800">PKR {wallet.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', unlocked ? 'text-emerald-600' : 'text-slate-400')}>
                        {unlocked ? <Ban className="w-3 h-3 rotate-180" /> : <Ban className="w-3 h-3" />} {unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(kycStatus === 'APPROVED' || kycStatus === 'REJECTED') && (
                          <button
                            onClick={() => onAction(u, 'reset_kyc')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 bg-amber-50 rounded-lg px-2.5 py-1.5 transition-colors"
                            title="Reset KYC so the user can resubmit"
                          >
                            <RotateCcw className="w-3 h-3" /> Resubmit KYC
                          </button>
                        )}
                        {u.blocked ? (
                          <button
                            onClick={() => onAction(u, 'unblock')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => onAction(u, 'block')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
                          >
                            <Ban className="w-3 h-3" /> Block
                          </button>
                        )}
                        <button
                          onClick={() => confirm(`Permanently delete ${u.name || u.phone}? This removes all their data.`) && onAction(u, 'delete')}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {hasMore && (
                <tr>
                  <td colSpan={7}>
                    <div className="flex justify-center py-3">
                      <button
                        onClick={loadMore}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 hover:bg-emerald-100 transition-colors"
                      >
                        Load more ({users.length - rowCount} remaining)
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ================= Loans =================

function LoansSection({ loans, total, filter, setFilter, search, setSearch, onMarkRepaid, totalRepayable, statusLabel }: any) {
  const chips: { id: LoanFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'INST1_APPROVED', label: 'APPROVED' },
    { id: 'DP_APPROVED', label: 'DOWN PAYMENT APPROVED' },
    { id: 'DP_PENDING', label: 'DOWN PAYMENT PENDING' },
    { id: 'WITHDRAWN', label: 'WITHDRAWN' },
    { id: 'REPAID', label: 'REPAY' },
    { id: 'REJECTED', label: 'REJECTED' },
  ]
  return (
    <div>
      <PageHeader icon={ListChecks} title="Loans" desc="All user loans" />
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {chips.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} tone={c.id === 'ALL' ? 'emerald' : 'slate'}>
            {c.label}
          </FilterChip>
        ))}
        <span className="text-xs text-slate-500 font-medium ml-auto">{total.toLocaleString()} total loans</span>
      </div>
      <div className="mb-5 max-w-xl">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone, CNIC, amount..." />
      </div>

      {loans.length === 0 ? (
        <EmptyState icon={<ListChecks className="w-12 h-12" />} title="No loans in this view" subtitle="Loan applications appear here as users apply." />
      ) : (
        <InfiniteList
          items={loans}
          chunk={6}
          className="space-y-4 pb-8"
          render={(l: any) => {
            const label = statusLabel(l)
            const total = totalRepayable(l)
            const markupPct = Math.round((l.interestRate || 0) * 10) / 10
            const canRepaid = l.status !== 'COMPLETED' && (l.installments || []).length > 0
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-slate-900">PKR {Number(l.amount).toLocaleString()}</h3>
                      <StatusBadge status={label} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      User: <span className="font-semibold text-slate-700">{l.user?.name || 'Unnamed'}</span> · {l.user?.phone}
                    </p>
                    <p className="text-xs text-slate-500">Created: {fmtDateTime(l.createdAt)}</p>
                    {l.withdrawalTxnId && <p className="text-xs text-emerald-700 font-semibold mt-0.5">TXN: {l.withdrawalTxnId}</p>}
                  </div>
                  <div className="text-xs space-y-0.5 md:text-right shrink-0">
                    <p className="text-slate-500">Total: <span className="font-bold text-slate-900">PKR {total.toLocaleString()}</span></p>
                    <p className="text-slate-500">Markup: <span className="font-semibold text-slate-700">{markupPct}%</span></p>
                    <p className="text-slate-500">Weekly: <span className="font-semibold text-slate-700">PKR {Number(l.weeklyInstallment).toLocaleString()}</span></p>
                    <p className="text-slate-500">Down Pay: <span className="font-semibold text-slate-700">PKR {Number(l.downpaymentAmount || 0).toLocaleString()}</span></p>
                  </div>
                </div>

                {(l.installments || []).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-4">
                    {l.installments.map((i: any) => (
                      <span
                        key={i.id}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border',
                          i.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : i.proofImage
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                        )}
                      >
                        Week {i.installmentNumber}: PKR {Number(i.amount).toLocaleString()}
                        <span className="opacity-70">({i.status})</span>
                      </span>
                    ))}
                  </div>
                )}

                {canRepaid && (
                  <div className="flex justify-end mt-4">
                    <Button onClick={() => onMarkRepaid(l.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark as Repaid
                    </Button>
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

// ================= Customer Videos =================

function VideosSection({ videos, form, setForm, uploading, onUpload, onDelete }: any) {
  return (
    <div>
      <PageHeader icon={Camera} title="Customer Videos" desc='Upload short videos shown in "Our Satisfied Customers" on the home page' />
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 max-w-2xl">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Add a new video</h3>
        <label
          className={cn(
            'block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors',
            form.file && 'border-emerald-400 bg-emerald-50/40'
          )}
        >
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
          />
          <UploadCloud className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          {form.file ? (
            <p className="text-xs font-semibold text-emerald-700">{form.file.name} ({(form.file.size / (1024 * 1024)).toFixed(1)}MB)</p>
          ) : (
            <p className="text-xs text-slate-500 font-medium">Tap to choose a video (MP4 / WebM / MOV, max 60MB)</p>
          )}
        </label>
        <div className="space-y-3 mt-4">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Ahsan from Lahore)" className="h-11 rounded-xl" />
          <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtitle (e.g. Got my loan in 2 days)" className="h-11 rounded-xl" />
          <Button onClick={onUpload} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-xl text-sm font-bold px-6">
            <UploadCloud className="w-4 h-4 mr-2" /> {uploading ? 'Uploading…' : 'Upload Video'}
          </Button>
        </div>
      </div>

      {videos.length === 0 ? (
        <EmptyState icon={<VideoIcon className="w-12 h-12" />} title="No videos yet" subtitle="Uploaded videos appear on the home page under Our Satisfied Customers." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
          {videos.map((v: any) => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
              <div className="bg-black aspect-video">
                <video src={v.url} controls preload="metadata" className="w-full h-full" />
              </div>
              <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{v.title}</p>
                  {v.subtitle && <p className="text-xs text-slate-500 truncate">{v.subtitle}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">{fmtDate(v.createdAt)}</p>
                </div>
                <button
                  onClick={() => onDelete(v.id)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ================= Bank / Deposit Accounts =================

function BankSection({ accounts, form, setForm, saving, onSave, onDelete, onToggleActive }: any) {
  return (
    <div>
      <PageHeader icon={Building2} title="Bank / Deposit Accounts" desc="Company accounts where users send downpayments and installments" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">{form.id ? 'Edit account' : 'Add a new account'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Method / Bank name *</label>
              <Input value={form.method || ''} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="e.g. EasyPaisa, JazzCash, HBL" className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Account title *</label>
              <Input value={form.accountTitle || ''} onChange={(e) => setForm({ ...form, accountTitle: e.target.value })} placeholder="Account holder name" className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Account number *</label>
              <Input value={form.accountNumber || ''} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="03XXXXXXXXX / IBAN" className="h-10 rounded-xl text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">Color</label>
              <input type="color" value={form.color || '#00A651'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-8 rounded cursor-pointer border border-slate-200" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 rounded-xl text-xs font-bold px-5">
                {saving ? 'Saving…' : form.id ? 'Update account' : 'Add account'}
              </Button>
              {form.id && (
                <Button variant="outline" onClick={() => setForm({})} className="h-10 rounded-xl text-xs font-semibold">Cancel</Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {accounts.length === 0 ? (
            <EmptyState icon={<Building2 className="w-12 h-12" />} title="No deposit accounts yet" subtitle="Add the accounts users should send money to." />
          ) : (
            accounts.map((acc: any) => (
              <div key={acc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: acc.color || '#00A651' }}>
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{acc.method}</p>
                    <p className="text-xs text-slate-500 truncate">{acc.accountTitle} · {acc.accountNumber}</p>
                    {!acc.isActive && <span className="text-[10px] font-bold text-amber-600">HIDDEN FROM USERS</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onToggleActive(acc)} className={cn('text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border transition-colors', acc.isActive ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-slate-500 border-slate-200')} title="Toggle visibility">
                    {acc.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => setForm(acc)} className="text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5">Edit</button>
                  <button onClick={() => onDelete(acc.id)} className="text-[11px] font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ================= Settings =================

function SettingsSection(props: any) {
  const {
    appInfo, appBusy, onUploadApp, onDeleteApp,
    smsOtpEnabled, smsToggleLoading, onToggleSms,
    referralBonus, setReferralBonus,
    downpaymentPct, setDownpaymentPct,
    markupPct, setMarkupPct,
    loyaltyReducePct, setLoyaltyReducePct,
    loyaltyMinMarkupPct, setLoyaltyMinMarkupPct,
    loanPackages, setLoanPackages,
    tawkEnabled, setTawkEnabled,
    tawkWidgetId, setTawkWidgetId,
    smsApi, setSmsApi,
    saving, onSave,
    pwCurrent, setPwCurrent, pwNew, setPwNew, pwConfirm, setPwConfirm, pwChanging, onChangePassword,
  } = props

  return (
    <div>
      <PageHeader icon={AlertCircle} title="Settings" desc="Configure company account, loan packages, chat & admin credentials" accent="bg-slate-800" />

      {/* Mobile App (APK) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
        <h3 className="text-sm font-bold text-slate-800">Mobile App (Android APK)</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">Upload your .apk — a &quot;Download App&quot; button appears on the home page.</p>
        {appInfo?.available ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs text-emerald-800">
              Live: <a href={appInfo.url} className="font-bold underline" target="_blank" rel="noreferrer">current APK</a>
              {appInfo.size ? ` (${(appInfo.size / (1024 * 1024)).toFixed(1)}MB)` : ''}
            </p>
            <button onClick={onDeleteApp} disabled={appBusy} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : null}
        <label className="block border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
          <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadApp(f) }} />
          <UploadCloud className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Tap to choose .apk (max {Math.round(MAX_APP_UPLOAD_SIZE / (1024 * 1024))}MB){appBusy ? ' — uploading…' : ''}</p>
        </label>
      </div>

      {/* Loan configuration + general */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Loan Configuration</h3>
          </div>
          <div className="space-y-3.5">
            <Field label="Markup %">
              <Input type="number" min="0" max="100" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} className="h-10 rounded-xl text-sm" />
            </Field>
            <Field label="Down Payment %">
              <Input type="number" min="1" max="100" value={downpaymentPct} onChange={(e) => setDownpaymentPct(e.target.value)} className="h-10 rounded-xl text-sm" />
            </Field>
            <Field label="Loyalty: reduce markup by % per repaid loan">
              <Input type="number" min="0" max="100" value={loyaltyReducePct} onChange={(e) => setLoyaltyReducePct(e.target.value)} className="h-10 rounded-xl text-sm" />
            </Field>
            <Field label="Minimum markup % (loyalty floor)">
              <Input type="number" min="0" max="100" value={loyaltyMinMarkupPct} onChange={(e) => setLoyaltyMinMarkupPct(e.target.value)} className="h-10 rounded-xl text-sm" />
            </Field>
            <Field label="Loan Packages (comma-separated PKR amounts)">
              <Input value={loanPackages} onChange={(e) => setLoanPackages(e.target.value)} placeholder="8000,14000,18500,24000" className="h-10 rounded-xl text-sm" />
            </Field>
            <Field label="Referral Bonus (PKR)">
              <Input type="number" min="0" value={referralBonus} onChange={(e) => setReferralBonus(e.target.value)} className="h-10 rounded-xl text-sm" />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          {/* Live chat */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Live Chat</h3>
              </div>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', tawkEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                {tawkEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Show or hide the live chat button across the user app and website.</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setTawkEnabled(true)}
                className={cn('h-9 rounded-xl text-xs font-bold border transition-colors', tawkEnabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300')}
              >
                Chat On
              </button>
              <button
                onClick={() => setTawkEnabled(false)}
                className={cn('h-9 rounded-xl text-xs font-bold border transition-colors', !tawkEnabled ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
              >
                Chat Off
              </button>
            </div>
            <Field label="Tawk widget id (optional)">
              <Input value={tawkWidgetId} onChange={(e) => setTawkWidgetId(e.target.value)} placeholder="e.g. 1h2j3k4/property" className="h-10 rounded-xl text-sm" />
            </Field>
          </div>

          {/* OTP delivery */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">OTP Delivery</h3>
              <button
                onClick={onToggleSms}
                disabled={smsToggleLoading}
                className={cn('relative w-11 h-6 rounded-full transition-colors', smsOtpEnabled ? 'bg-emerald-600' : 'bg-slate-300')}
                aria-label="Toggle SMS OTP"
              >
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', smsOtpEnabled ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {smsOtpEnabled ? 'OTP codes are sent via the SMS/WhatsApp gateway.' : 'OTP codes are returned inline (demo mode).'}
            </p>
            <div className="space-y-3">
              <Field label="Channel">
                <Select value={smsApi.channel} onValueChange={(v) => setSmsApi({ ...smsApi, channel: v })}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Gateway API secret">
                <Input type="password" value={smsApi.secret} onChange={(e) => setSmsApi({ ...smsApi, secret: e.target.value })} placeholder="API key / secret" className="h-10 rounded-xl text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="WhatsApp sender">
                  <Input value={smsApi.account} onChange={(e) => setSmsApi({ ...smsApi, account: e.target.value })} placeholder="+92300…" className="h-10 rounded-xl text-sm" />
                </Field>
                <Field label="SIM / Device">
                  <Input value={smsApi.sim} onChange={(e) => setSmsApi({ ...smsApi, sim: e.target.value })} placeholder="1" className="h-10 rounded-xl text-sm" />
                </Field>
              </div>
            </div>
          </div>

          {/* Admin password */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Admin Password</h3>
            <div className="space-y-3">
              <Field label="Current password">
                <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className="h-10 rounded-xl text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="New password">
                  <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} className="h-10 rounded-xl text-sm" />
                </Field>
                <Field label="Confirm new">
                  <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className="h-10 rounded-xl text-sm" />
                </Field>
              </div>
              <Button onClick={onChangePassword} disabled={pwChanging} variant="outline" className="h-10 rounded-xl text-xs font-bold border-slate-300">
                {pwChanging ? 'Updating…' : 'Change password'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-8 sticky bottom-0">
        <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-xl text-sm font-bold px-8 shadow-lg">
          <CheckCircle2 className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save all settings'}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
      {children}
    </div>
  )
}

// ================= Logs =================

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [type, setType] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  const loadLogs = (t: string) => {
    api(`/api/admin/activity?limit=200${t !== 'ALL' ? `&type=${encodeURIComponent(t)}` : ''}`)
      .then((res) => {
        setLogs(res.logs || [])
        setTypes(res.types || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true)
      loadLogs(type)
    }, 0)
    return () => clearTimeout(id)
  }, [type])

  return (
    <div>
      <PageHeader icon={History} title="Activity Logs" desc="Full audit trail of admin actions" accent="bg-slate-800" />
      <div className="mb-4 flex gap-2 flex-wrap">
        <FilterChip active={type === 'ALL'} onClick={() => setType('ALL')}>All</FilterChip>
        {types.slice(0, 12).map((t) => (
          <FilterChip key={t} active={type === t} onClick={() => setType(t)} tone="slate">{t}</FilterChip>
        ))}
      </div>
      {loading ? (
        <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Loading logs…</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<History className="w-12 h-12" />} title="No activity yet" subtitle="Admin actions will be logged here." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-50">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50/60">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{log.action}</p>
                  {log.details && <p className="text-xs text-slate-500 truncate">{log.details}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {log.actor} · {log.type}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtDateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
