export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-white/10" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
          >
            <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-8 w-36 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-3 h-4 w-24 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
