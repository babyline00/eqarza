'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Chunked-list primitives used by the admin lists (KYC, payments, withdrawals,
// loans…) so only the items that fit on / near the screen are added to the DOM.
// The next chunk is appended when a sentinel row scrolls into view, with a
// visible "Load more" button as a fallback.

export function useChunked(total: number, chunk = 8) {
  const [count, setCount] = useState(() => Math.min(chunk, total))
  const [lastTotal, setLastTotal] = useState(total)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reconcile the visible count with the incoming list size (React's
  // "adjust state during render" pattern — no effect needed). When the
  // underlying collection changed (new search/filter/data) we clamp back to a
  // single chunk if needed; if it didn't, a grown count is kept so silent
  // refreshes never collapse a list the user already scrolled through.
  if (lastTotal !== total) {
    setLastTotal(total)
    setCount((c) => Math.min(Math.max(c, chunk), total))
  }

  const hasMore = count < total
  const loadMore = () => setCount((c) => Math.min(c + chunk, total))

  return { visible: count, hasMore, loadMore, setSentinel: sentinelRef }
}

export function InfiniteList<T>({
  items,
  render,
  chunk = 8,
  className,
  empty,
}: {
  items: T[]
  render: (item: T, index: number) => ReactNode
  chunk?: number
  className?: string
  empty?: ReactNode
}) {
  const total = items.length
  const { visible, hasMore, loadMore, setSentinel } = useChunked(total, chunk)

  const shown = items.slice(0, visible)

  useEffect(() => {
    const el = setSentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || !hasMore) return
        loadMore()
      },
      { rootMargin: '120px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, chunk, total, loadMore, setSentinel])

  if (total === 0) return <>{empty}</>

  return (
    <div className={className}>
      {shown.map((item, i) => (
        <Fragment key={i}>{render(item, i)}</Fragment>
      ))}
      <div ref={setSentinel} className="min-h-[1px] col-span-full">
        {hasMore ? (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 hover:bg-emerald-100 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Load more ({total - visible} remaining)
            </button>
          </div>
        ) : (
          visible > 0 &&
          total > chunk && (
            <p className="text-center text-[10px] text-slate-400 py-2 border-t border-slate-100">
              All {total.toLocaleString()} loaded
            </p>
          )
        )}
      </div>
    </div>
  )
}

const Fragment = ({ children }: { children: ReactNode }) => <>{children}</>