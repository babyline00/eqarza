'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/store'
import { LoginScreen, OtpScreen } from '@/components/screens/login'
import { KycScreen } from '@/components/screens/kyc'
import { EligibilityScreen } from '@/components/screens/eligibility'
import { WithdrawalScreen } from '@/components/screens/withdrawal'
import { DownpaymentScreen } from '@/components/screens/downpayment'
import { FirstInstallmentScreen } from '@/components/screens/first-installment'
import { DashboardScreen } from '@/components/screens/dashboard'
import { MyLoanScreen } from '@/components/screens/my-loan'
import { ProfileScreen } from '@/components/screens/profile'
import { NotificationsScreen } from '@/components/screens/notifications'
import { AdminLoginScreen } from '@/components/screens/admin-login'
import { AdminDashboardScreen } from '@/components/screens/admin-dashboard'
import { ChatWidget } from '@/components/chat-widget'

export default function Home() {
  const { token, adminToken, adminIsStaff, view, setView } = useAuth()
  const [hydrated, setHydrated] = useState(false)

  // Wait for Zustand persisted store to hydrate (client-only)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  // Auto-route on mount: if logged in go to dashboard, else login
  useEffect(() => {
    if (!hydrated) return
    if (adminToken && adminIsStaff !== true && (view === 'login' || view === 'admin_login')) {
      setView('admin_dashboard')
    } else if (adminIsStaff === true && (view === 'admin_login' || view === 'admin_dashboard')) {
      setView('login')
    } else if (token && view === 'login') {
      setView('dashboard')
    }
  }, [hydrated, token, adminToken, adminIsStaff, view, setView])

  if (!hydrated) {
    return (
      <div className="min-h-dvh bg-emerald-50 flex items-center justify-center">
        <div className="text-emerald-600 animate-pulse text-sm">Loading E-Qarza...</div>
      </div>
    )
  }

  return (
    <>
      {!adminToken && <ChatWidget />}
      <ViewRouter />
    </>
  )
}

function ViewRouter() {
  const { token, adminToken, adminIsStaff, view, setView } = useAuth()

  // Staff are not allowed to access admin — redirect to user app
  if (adminIsStaff && (view === 'admin_dashboard' || view === 'admin_login')) {
    setView('login')
    return <LoginScreen />
  }

  // Admin routes
  if (view === 'admin_login') return <AdminLoginScreen />
  if (view === 'admin_dashboard' || adminToken) {
    if (!adminToken || adminIsStaff) return <AdminLoginScreen />
    return <AdminDashboardScreen />
  }

  // User routes — require auth (login/otp are pre-auth)
  if (!token && !['login', 'otp'].includes(view)) {
    return <LoginScreen />
  }

  switch (view) {
    case 'login':
      return <LoginScreen />
    case 'otp':
      return <OtpScreen />
    case 'kyc':
      return <KycScreen />
    case 'eligibility':
      return <EligibilityScreen />
    case 'withdrawal':
      return <WithdrawalScreen />
    case 'downpayment':
      return <DownpaymentScreen />
    case 'first_installment':
      return <FirstInstallmentScreen />
    case 'notifications':
      return <NotificationsScreen />
    case 'my_loan':
      return <MyLoanScreen />
    case 'profile':
      return <ProfileScreen />
    case 'dashboard':
    default:
      return <DashboardScreen />
  }
}
