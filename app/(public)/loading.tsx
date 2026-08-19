export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12 md:py-16" aria-live="polite" aria-busy="true">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-14">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <div className="h-6 w-48 animate-pulse rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-12 w-full max-w-xl animate-pulse rounded-xl bg-white/10 md:h-16" />
              <div className="h-12 w-4/5 max-w-lg animate-pulse rounded-xl bg-white/10 md:h-16" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-white/10" />
              <div className="h-5 w-5/6 max-w-xl animate-pulse rounded bg-white/10" />
            </div>
            <div className="flex gap-3">
              <div className="h-12 w-40 animate-pulse rounded-xl bg-white/10" />
              <div className="h-12 w-36 animate-pulse rounded-xl bg-white/10" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 md:p-8">
            <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-8 w-3/4 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-6 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
    </div>
  )
}
