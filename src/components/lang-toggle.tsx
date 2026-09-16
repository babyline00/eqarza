'use client'

import { useAuth } from '@/lib/store'
import { cn } from '@/lib/utils'

export function LangToggle({ className, light = false }: { className?: string; light?: boolean }) {
  const { lang, setLang } = useAuth()
  const next = lang === 'en' ? 'ur' : 'en'
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className={cn(
        'text-xs px-2.5 py-1 rounded-md font-semibold transition-colors',
        light ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        className
      )}
      title={lang === 'en' ? 'اردو میں دیکھیں' : 'View in English'}
    >
      {lang === 'en' ? 'اردو' : 'EN'}
    </button>
  )
}