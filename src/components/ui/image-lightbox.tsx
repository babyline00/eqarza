'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function ImageLightbox() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const onOpen = (e: Event) => setSrc((e as CustomEvent<string>).detail)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSrc(null)
    }
    window.addEventListener('app:lightbox', onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('app:lightbox', onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
      onClick={() => setSrc(null)}
    >
      <button
        className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 text-white p-2"
        onClick={() => setSrc(null)}
        aria-label="Close preview"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
      />
      <p className="absolute bottom-4 text-[11px] text-slate-400">Click anywhere or press Esc to close</p>
    </div>
  )
}