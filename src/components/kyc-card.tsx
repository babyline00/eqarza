'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const SCAN_KEYFRAMES = `@keyframes eqz-kyc-scan { 0% { top: -46px; } 55%, 100% { top: 154px; } }`

const STATUS_TASKS = [
  'Scanning your documents',
  'Matching your selfie',
  'Verifying CNIC with NADRA',
]

const STATUS_TASK_ICONS = [ScanIcon, ShieldIcon, CameraIcon]

export function KycScanCard({ cnic, frontImage }: { cnic?: string; frontImage?: string | null }) {
  const maskedCnic = cnic ? `${cnic.slice(0, 5)}-•••••••-${cnic.slice(-1)}` : '42101-•••••••--'
  return (
    <div>
      <div className="rounded-[20px] overflow-hidden border border-[#fdba74] w-full shadow-[0_22px_40px_-14px_rgba(234,88,12,.42)]">
        <div className="bg-gradient-to-r from-[#ff9444] to-[#FE6601] px-4 py-[14px] flex justify-between items-center text-white text-[11.5px] font-extrabold tracking-[2.5px]">
          <span>ISLAMIC REPUBLIC OF PAKISTAN</span>
          <span className="flex items-center gap-1.5 tracking-[1.5px]">NADRA</span>
        </div>
        <div className="relative h-[200px] bg-[#0a0c0a] overflow-hidden">
          {frontImage ? (
            <img
              src={frontImage}
              alt="Uploaded CNIC Front"
              className="absolute inset-0 w-full h-full object-cover opacity-70"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,10,.1),rgba(10,12,10,.4))]" />
          <div
            className="absolute left-0 right-0 h-[46px] bg-[linear-gradient(180deg,transparent,rgba(52,211,153,.35),transparent)]"
            style={{ animation: 'eqz-kyc-scan 2.8s ease-in-out infinite' }}
          />
          <Corner className="top-[14px] left-[14px] border-r-0 border-b-0 rounded-tl-[10px]" />
          <Corner className="top-[14px] right-[14px] border-l-0 border-b-0 rounded-tr-[10px]" />
          <Corner className="bottom-[14px] left-[14px] border-r-0 border-t-0 rounded-bl-[10px]" />
          <Corner className="bottom-[14px] right-[14px] border-l-0 border-t-0 rounded-br-[10px]" />
        </div>
        <div className="relative bg-[linear-gradient(180deg,#3a2008,#221202)] border-t-2 border-[#FE6601] px-4 py-[14px] text-white font-mono text-sm tracking-[1.5px]">
          {maskedCnic}
        </div>
      </div>
      <style>{SCAN_KEYFRAMES}</style>
    </div>
  )
}

export function KycStatusList() {
  const [task, setTask] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - t0
      const p = Math.min(100, (elapsed / 28000) * 100)
      if (p >= 95) setTask(2)
      else if (p >= 68) setTask(1)
      else if (p >= 26) setTask(0)
      if (p >= 100) {
        setDone(true)
        clearInterval(iv)
      }
    }, 200)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex flex-col gap-[6px]">
      {STATUS_TASKS.map((label, i) => {
        const Icon = STATUS_TASK_ICONS[i]
        const isDone = task > i || done
        const isActive = task === i && !done
        return (
          <div
            key={label}
            className={`flex items-center gap-[5px] px-[4px] py-[2px] rounded-[20px] border-[1.5px] transition-colors duration-300 ${
              isDone
                ? 'bg-[#e9fbf2] border-[#c9eed9]'
                : isActive
                ? 'bg-[#fff6ec] border-[#ffe3c2]'
                : 'bg-white border-[#e5e7eb]'
            }`}
          >
            <span className="w-[26px] grid place-items-center flex-none">
              {isDone ? (
                <CheckCircle2 className="w-6 h-6 text-[#0e8a4c] stroke-[2.2]" />
              ) : isActive ? (
                <span className="w-[22px] h-[22px] rounded-full border-[3px] border-[#fcd9ad] border-t-[#f97316] animate-spin" />
              ) : (
                <span className="w-[19px] h-[19px] rounded-full border-[3px] border-[#d7dce2]" />
              )}
            </span>
            <span
              className={`w-[42px] h-[42px] rounded-[13px] grid place-items-center flex-none transition-colors duration-300 ${
                isDone
                  ? 'bg-[#d7f5e4] text-[#0e8a4c]'
                  : isActive
                  ? 'bg-[#ffedd5] text-[#ea7c12]'
                  : 'bg-[#f1f3f5] text-[#9aa3af]'
              }`}
            >
              <Icon />
            </span>
            <span
              className={`text-base leading-[1.35] ${
                isDone ? 'text-[#0e8a4c] font-bold' : isActive ? 'text-[#1f2937] font-bold' : 'text-[#9aa3af] font-semibold'
              }`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute w-7 h-7 border-[3.5px] border-[#f59e0b] ${className}`} />
}

function ScanIcon() {
  return (
    <svg className="w-[21px] h-[21px] fill-none stroke-current stroke-2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h7M7 13h4M15.5 9.5l2 2-2 2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-[21px] h-[21px] fill-none stroke-current stroke-2" viewBox="0 0 24 24">
      <path d="M12 22s8-3.6 8-10V5.5L12 2 4 5.5V12c0 6.4 8 10 8 10z" />
      <path d="m9 11.5 2 2 4-4" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg className="w-[21px] h-[21px] fill-none stroke-current stroke-2" viewBox="0 0 24 24">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}