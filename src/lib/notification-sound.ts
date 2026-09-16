'use client'

type NotificationKind = 'kyc' | 'payment' | 'loan' | 'other'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(ctx: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + start
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function playNotificationSound(kind: NotificationKind = 'other') {
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (kind === 'kyc') {
      tone(ctx, 880, 0, 0.16, 0.22)      // A5
      tone(ctx, 1108.73, 0.15, 0.2, 0.22) // C#6
      tone(ctx, 1318.51, 0.3, 0.32, 0.26) // E6
    } else if (kind === 'payment') {
      tone(ctx, 660, 0, 0.15, 0.26)      // E5
      tone(ctx, 880, 0.15, 0.3, 0.26)    // A5
    } else if (kind === 'loan') {
      tone(ctx, 523.25, 0, 0.16, 0.26)   // C5
      tone(ctx, 659.25, 0.14, 0.2, 0.26) // E5
      tone(ctx, 783.99, 0.28, 0.32, 0.26) // G5
    } else {
      tone(ctx, 740, 0, 0.22, 0.24)
      tone(ctx, 880, 0.2, 0.28, 0.24)
    }
  } catch {
    // ignore audio errors (blocked autoplay etc.)
  }
}