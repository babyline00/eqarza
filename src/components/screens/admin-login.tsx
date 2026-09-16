'use client'

import { useEffect, useState } from 'react'
import { useAuth, api } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { ShieldCheck, Lock, ArrowLeft, AlertTriangle } from 'lucide-react'

export function AdminLoginScreen() {
  const { setView, setAdmin } = useAuth()
  const { toast } = useToast()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockedFor, setLockedFor] = useState(0)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)

  // Countdown while the IP is locked out
  useEffect(() => {
    if (lockedFor <= 0) return
    const id = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [lockedFor > 0])

  const submit = async () => {
    if (lockedFor > 0) return
    if (!username || !password) {
      toast({ title: 'Missing', description: 'Username and password required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await api('/api/admin/login', { method: 'POST', body: { username, password } })
      setAdmin({ token: res.token, username: res.username, isStaff: res.isStaff })
      toast({ title: 'Welcome Admin!', description: 'Logged in successfully' })
      setView('admin_dashboard')
    } catch (e: any) {
      if (e?.status === 429 && Number(e?.data?.lockedFor) > 0) {
        setLockedFor(Number(e.data.lockedFor))
        setRemainingAttempts(0)
        toast({
          title: 'Login locked',
          description: 'Too many failed attempts. Try again in a few minutes.',
          variant: 'destructive',
        })
      } else if (typeof e?.data?.remainingAttempts === 'number' && e.data.remainingAttempts > 0) {
        setRemainingAttempts(e.data.remainingAttempts)
        toast({ title: 'Login failed', description: e?.message || 'Invalid credentials', variant: 'destructive' })
      } else {
        toast({ title: 'Login failed', description: e?.message || 'Invalid credentials', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }

  const locked = lockedFor > 0
  const mins = Math.floor(lockedFor / 60)
  const secs = lockedFor % 60

  return (
    <div className="min-h-dvh w-full bg-slate-900 flex justify-center">
      <div className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-dvh flex flex-col px-6 py-12">
        {/* Back button */}
        <button
          onClick={() => setView('login')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to User App
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-400/20">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">E-Qarza Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Loan Management Console</p>
        </div>

        {locked && (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Login locked temporarily</p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Too many failed attempts from this IP. Try again in {mins}:{String(secs).padStart(2, '0')}.
              </p>
            </div>
          </div>
        )}

        {remainingAttempts !== null && remainingAttempts > 0 && !locked && (
          <div className="mb-4 rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <p className="text-xs text-slate-300">
              Wrong username or password. <span className="font-bold text-amber-300">{remainingAttempts}</span> attempt
              {remainingAttempts === 1 ? '' : 's'} left before temporary lockout.
            </p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-5">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                disabled={locked}
                className="mt-1 h-11"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={locked}
                className="mt-1 h-11"
                onKeyDown={(e) => e.key === 'Enter' && !locked && submit()}
              />
            </div>

            <Button
              onClick={submit}
              disabled={loading || locked}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
            >
              <Lock className="w-4 h-4 mr-2" />
              {locked ? `Locked (${mins}:${String(secs).padStart(2, '0')})` : loading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Authorized personnel only. All actions are logged.
        </p>
      </div>
    </div>
  )
}
