'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/store'
import { AdminLoginScreen } from '@/components/screens/admin-login'
import { AdminDashboardScreen } from '@/components/screens/admin-dashboard'

// Rendered when the URL matches the configured admin panel path
// (see src/app/[...slug]/page.tsx). Shows the login or dashboard.
export default function AdminRoute() {
  const { adminToken, setView } = useAuth()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !adminToken) setView('admin_login')
  }, [hydrated, adminToken, setView])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse text-sm">Loading admin...</div>
      </div>
    )
  }

  if (adminToken) return <AdminDashboardScreen />
  return <AdminLoginScreen />
}