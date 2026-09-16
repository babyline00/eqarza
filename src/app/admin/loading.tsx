export default function Loading() {
  return (
    <div className="min-h-dvh w-full bg-slate-200/70 flex justify-center overflow-hidden">
      <div className="relative flex w-full h-dvh bg-slate-50 shadow-2xl overflow-hidden">
        <aside className="flex flex-col w-64 bg-slate-900 text-slate-200 shrink-0 h-full">
          <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10 shrink-0">
            <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center shrink-0 animate-pulse">
              <div className="w-5 h-5 bg-white rounded" />
            </div>
            <div className="min-w-0 leading-tight flex-1">
              <p className="text-sm font-bold text-white animate-pulse">E-Qarza Admin</p>
              <p className="text-[10px] text-slate-400 animate-pulse">Management Console</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto scroll-area px-2.5 py-3 space-y-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </nav>
          <div className="px-2.5 py-3 border-t border-white/10 space-y-1 shrink-0">
            <div className="h-9 bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-9 bg-red-500/10 rounded-lg animate-pulse" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col h-full">
          <header className="shrink-0 z-30 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 h-16 animate-pulse" />
          <div className="flex-1 overflow-y-auto scroll-area min-h-0 p-6">
            <div className="w-full max-w-5xl mx-auto space-y-4">
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-1/3" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-28 animate-pulse" />
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-64 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}