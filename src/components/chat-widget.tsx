'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    Tawk_API?: any
  }
}

// Loads the tawk.to live-chat widget ONLY when the admin has enabled it and a
// widget id is configured. The base script is already embedded in layout.tsx
// (from the admin settings), so this component only configures the widget
// settings after it loads.
export function ChatWidget() {
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        if (cancelled) return
        if (!data?.tawkEnabled || !data?.tawkWidgetId) return

        const [propertyId, widgetId] = String(data.tawkWidgetId).split('/')
        if (!propertyId || !widgetId) return

        // Only inject the script if not already present (layout.tsx embeds it)
        const existing = document.querySelector('script[src*="tawk.to"]')
        if (!existing) {
          const s1 = document.createElement('script')
          s1.async = true
          s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}/default`
          s1.charset = 'UTF-8'
          s1.setAttribute('crossorigin', '*')
          s1.setAttribute('data-tawk', 'true')
          document.body.appendChild(s1)
        }

        // Configure widget properties if Tawk_API is available
        if (window.Tawk_API) {
          try {
            window.Tawk_API.init({
              propertyId,
              widgetId,
            })
          } catch {
            // init is optional — the script already loaded from layout.tsx
          }
        }
      } catch {
        // chat is non-critical; fail silently
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
