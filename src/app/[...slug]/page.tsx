import { notFound } from 'next/navigation'
import { getAdminPath, invalidateSetting, SETTING_ADMIN_PATH } from '@/lib/settings'
import AdminRoute from '@/components/screens/admin-route'

// Catch-all so the admin panel can live at ANY custom path (e.g. /admin,
// /newadmin, /anything) without a rebuild. Only the path currently configured
// in Settings (DB > ADMIN_PATH env) renders the panel; every other path 404s.
// api/* is untouched — those are separate literal routes.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function DynamicPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params
  const requestPath = slug.join('/')

  // Read the panel path fresh on every request (dev compiles separate module
  // instances per route, so a shared in-memory cache would serve stale values).
  invalidateSetting(SETTING_ADMIN_PATH)
  const configured = await getAdminPath()

  if (requestPath !== configured) notFound()
  return <AdminRoute />
}