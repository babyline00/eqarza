'use client'

export function openImage(src: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app:lightbox', { detail: src }))
}