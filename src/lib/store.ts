'use client'

import { create } from 'zustand'
import { persist, PersistOptions } from 'zustand/middleware'

export type View =
  | 'login'
  | 'otp'
  | 'kyc'
  | 'eligibility'
  | 'withdrawal'
  | 'downpayment'
  | 'first_installment'
  | 'dashboard'
  | 'my_loan'
  | 'profile'
  | 'notifications'
  | 'admin_login'
  | 'admin_dashboard'

interface AuthState {
  // User
  token: string | null
  userId: string | null
  phone: string | null
  name: string | null

  // Admin
  adminToken: string | null
  adminUsername: string | null
  adminIsStaff: boolean | null

  // Routing
  view: View
  setView: (v: View) => void

  // Language
  lang: 'en' | 'ur'
  setLang: (l: 'en' | 'ur') => void

  // Auth helpers
  setUser: (data: { token: string; userId: string; phone: string }) => void
  logout: () => void

  setAdmin: (data: { token: string; username: string; isStaff?: boolean }) => void
  logoutAdmin: () => void
}

export const useAuth = create<AuthState>()(
  persist<AuthState>(
    (set) => ({
      token: null,
      userId: null,
      phone: null,
      name: null,
      adminToken: null,
      adminUsername: null,
      adminIsStaff: null,
      view: 'login',
      setView: (v) => set({ view: v }),
      lang: 'en',
      setLang: (l) => set({ lang: l }),
      setUser: (data) =>
        set({
          token: data.token,
          userId: data.userId,
          phone: data.phone,
          view: 'dashboard',
        }),
      logout: () =>
        set({
          token: null,
          userId: null,
          phone: null,
          name: null,
          view: 'login',
        }),
      setAdmin: (data) =>
        set({
          adminToken: data.token,
          adminUsername: data.username,
          adminIsStaff: data.isStaff ?? false,
          view: 'admin_dashboard',
        }),
      logoutAdmin: () =>
        set({
          adminToken: null,
          adminUsername: null,
          adminIsStaff: null,
          view: 'admin_login',
        }),
    }),
    { name: 'e-qarza-auth' } as PersistOptions<AuthState>
  )
)

// API helper
export async function api(path: string, opts: any = {}) {
  const token = useAuth.getState().token
  const adminToken = useAuth.getState().adminToken
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!token && adminToken) headers['Authorization'] = `Bearer ${adminToken}`

  const res = await fetch(path, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(data.error || `Request failed: ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function uploadFile(file: File) {
  const token = useAuth.getState().token || useAuth.getState().adminToken
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data.url as string
}

export const MAX_UPLOAD_SIZE = 8 * 1024 * 1024

export function pickFirstImage(e: React.ChangeEvent<HTMLInputElement>): File | null {
  const file = e.target.files?.[0]
  if (!file) return null
  return file
}

export function validateImageFile(file: File, opts: { maxSize?: number } = {}): string | null {
  const max = opts.maxSize || MAX_UPLOAD_SIZE
  if (!file.type.startsWith('image/')) return 'Please upload an image file'
  if (file.size > max) return `File too large. Maximum ${Math.round(max / (1024 * 1024))}MB allowed`
  return null
}

export const MAX_APP_UPLOAD_SIZE = 200 * 1024 * 1024

export async function uploadAppFile(apk: File) {
  const adminToken = useAuth.getState().adminToken
  const fd = new FormData()
  fd.append('apk', apk)
  const res = await fetch('/api/admin/app-upload', {
    method: 'POST',
    body: fd,
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'App upload failed')
  return data
}

export async function deleteAppFile() {
  const adminToken = useAuth.getState().adminToken
  const res = await fetch('/api/admin/app-upload', {
    method: 'DELETE',
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to remove app')
  return data
}

export async function fetchAppInfo() {
  const res = await fetch('/api/app-info')
  const data = await res.json().catch(() => ({}))
  return data
}
