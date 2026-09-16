'use client'

import { ReactNode, useState } from 'react'
import { Home, Wallet, Bell, User, ShieldCheck, Clock, AlertCircle, Users, RefreshCw, Building2, Settings, LogOut, Menu, X, History, ListChecks, Camera, UserCog } from 'lucide-react'
import { useAuth, View } from '@/lib/store'
import { useMediaQuery } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

interface PhoneFrameProps {
  children: ReactNode
  showBottomNav?: boolean
  activeTab?: 'home' | 'loan' | 'notifications' | 'profile'
}

export function PhoneFrame({ children, showBottomNav = true, activeTab = 'home' }: PhoneFrameProps) {
  const { setView, logout, lang } = useAuth()

  return (
    <div className="h-dvh w-full bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-white h-dvh shadow-2xl relative flex flex-col max-w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto scroll-area min-h-0">{children}</div>

        {showBottomNav && (
          <nav className="shrink-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around z-30 pb-safe">
            <NavBtn
              icon={<Home className="w-5 h-5" />}
              label={tr(lang, 'nav_home', 'Home')}
              active={activeTab === 'home'}
              onClick={() => setView('dashboard')}
            />
            <NavBtn
              icon={<Wallet className="w-5 h-5" />}
              label={tr(lang, 'nav_loan', 'My Loan')}
              active={activeTab === 'loan'}
              onClick={() => setView('my_loan')}
            />
            <NavBtn
              icon={<Bell className="w-5 h-5" />}
              label={tr(lang, 'nav_alerts', 'Alerts')}
              active={activeTab === 'notifications'}
              onClick={() => setView('notifications')}
            />
            <NavBtn
              icon={<User className="w-5 h-5" />}
              label={tr(lang, 'nav_profile', 'Profile')}
              active={activeTab === 'profile'}
              onClick={() => setView('profile')}
            />
          </nav>
        )}
      </div>
    </div>
  )
}

function NavBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all',
        active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:text-emerald-600'
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

// Header component for screens
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
      {onBack && (
        <button
          onClick={onBack}
          className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>
      {right}
    </header>
  )
}

export function AdminFrame({ children, activeTab = 'overview', onTabChange, onRefresh, badges, hiddenTabs, refreshing }: { children: ReactNode; activeTab?: string; onTabChange?: (t: string) => void; onRefresh?: () => void; badges?: Record<string, number>; hiddenTabs?: string[]; refreshing?: boolean }) {
  const { logoutAdmin } = useAuth()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isDesktop === undefined) {
    return (
      <div className="h-dvh w-full bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse text-sm">Loading admin...</div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Dashboard', title: 'Dashboard', icon: Home, desc: 'Quick overview of platform activity' },
    { id: 'kyc', label: 'KYC Review', title: 'KYC Review', icon: ShieldCheck, desc: 'Verify identity documents, request resubmission, or remove wrong accounts' },
    { id: 'payments', label: 'Payments', title: 'Payment Approvals', icon: Clock, desc: 'Review user-submitted payment screenshots' },
    { id: 'withdrawals', label: 'Withdrawals', title: 'Withdrawals', icon: Wallet, desc: "Send the money to the user's account, then record the Transaction ID" },
    { id: 'users', label: 'Users', title: 'Users', icon: Users, desc: 'Manage user accounts, KYC resets, and wrong approvals' },
    { id: 'loans', label: 'Loans', title: 'Loans', icon: ListChecks, desc: 'All user loans' },
    { id: 'videos', label: 'Customer Videos', title: 'Customer Videos', icon: Camera, desc: 'Upload short videos shown in "Our Satisfied Customers" on the home page' },
    { id: 'bank', label: 'Bank Accounts', title: 'Bank / Deposit Accounts', icon: Building2, desc: 'Company deposit accounts shown on the payment page' },
    { id: 'staff', label: 'Staff & Roles', title: 'Staff & Roles', icon: UserCog, desc: 'Create staff roles and manage staff access (super admin only)' },
    { id: 'settings', label: 'Settings', title: 'Settings', icon: Settings, desc: 'Configure company account, loan packages, chat & admin credentials' },
    { id: 'logs', label: 'Logs', title: 'Activity Logs', icon: History, desc: 'Full audit trail of admin actions' },
  ].filter((t) => !hiddenTabs?.includes(t.id))

  const activeTabMeta = tabs.find((t) => t.id === activeTab)
  const activeTitle = activeTabMeta?.title ?? 'Admin'

  const handleRefresh = () => {
    if (refreshing) return
    if (onRefresh) onRefresh()
    else window.location.reload()
  }

  const handleLogout = () => {
    if (confirm('Log out of the admin console?')) logoutAdmin()
  }

  const handleTabChange = (id: string) => {
    onTabChange?.(id)
    setSidebarOpen(false)
  }

  const sidebarCls = cn(
    'flex flex-col w-64 bg-slate-900 text-slate-200 shrink-0 h-full transition-transform duration-200 ease-in-out',
    isDesktop === false && sidebarOpen && 'fixed inset-y-0 left-0 z-50 shadow-2xl',
    isDesktop === false && !sidebarOpen && 'fixed inset-y-0 left-0 z-50 -translate-x-full',
    isDesktop === true && 'static translate-x-0'
  )

  return (
    <div className="h-dvh w-full bg-slate-200/70 flex justify-center overflow-hidden">
      <div className="relative flex w-full h-dvh bg-slate-50 shadow-2xl overflow-hidden">
        {/* Mobile backdrop */}
        {isDesktop === false && sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar — static on desktop, toggleable drawer on mobile */}
        <aside className={sidebarCls}>
          <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10 shrink-0">
            <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 leading-tight flex-1">
              <p className="text-sm font-bold text-white truncate">E-Qarza Admin</p>
              <p className="text-[10px] text-slate-400 truncate">Management Console</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto scroll-area px-2.5 py-3 space-y-0.5">
            {tabs.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  title={t.title}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all border',
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border-transparent'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-amber-400' : 'text-slate-400')} />
                  <span className="truncate flex-1 text-left">{t.label}</span>
                  {badges?.[t.id] ? (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-900">
                      {badges[t.id] > 99 ? '99+' : badges[t.id]}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <div className="px-2.5 py-3 border-t border-white/10 space-y-1 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={cn('w-4 h-4 text-slate-400', refreshing && 'animate-spin')} />{ refreshing ? 'Updating…' : 'Refresh data' }
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4 text-red-400" /> Logout
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col h-full">
          {/* Header */}
          <header className="shrink-0 z-30 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-md h-16">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold truncate">{activeTitle}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              {refreshing && (
                <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] bg-amber-400/20 text-amber-300 px-2.5 py-1.5 rounded-md font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Updating data…
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="lg:hidden text-[11px] bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white px-2.5 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1"
                title="Refresh data"
              >
                <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} /> Refresh
              </button>
              <button
                onClick={handleLogout}
                className="text-[11px] bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white px-2.5 py-1.5 rounded-md transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scroll-area min-h-0">
            <div className="w-full max-w-5xl mx-auto">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
