// Minimal in-memory sliding-window rate limiter. Intended for per-request
// abuse protection (OTP spam) on a single server process. Each key keeps a
// small array of timestamps; windows expire lazily.
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const prev = buckets.get(key) ?? []
  const active = prev.filter((t) => now - t < windowMs)

  if (active.length >= max) {
    buckets.set(key, active)
    return false
  }

  buckets.set(key, [...active, now])

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 10_000) {
    for (const [k, arr] of buckets) {
      if (arr.filter((t) => now - t < windowMs).length === 0) buckets.delete(k)
    }
  }

  return true
}