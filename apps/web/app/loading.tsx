export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div>
            <div className="h-5 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        {["w-24", "w-24", "w-32", "w-32", "w-32", "w-40"].map((width, i) => (
          <div key={i} className={`h-10 ${width} animate-pulse rounded-full bg-slate-100 dark:bg-slate-900`} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 p-5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-3 h-6 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 flex gap-1.5">
              <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-4 h-9 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
