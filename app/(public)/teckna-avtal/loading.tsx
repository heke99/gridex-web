export default function TecknaAvtalLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12 md:py-16" aria-live="polite" aria-busy="true">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <div className="h-6 w-64 animate-pulse rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-11 w-full max-w-xl animate-pulse rounded-xl bg-white/10" />
              <div className="h-11 w-3/4 max-w-md animate-pulse rounded-xl bg-white/10" />
              <div className="h-5 w-full max-w-2xl animate-pulse rounded-lg bg-white/5" />
              <div className="h-5 w-5/6 max-w-xl animate-pulse rounded-lg bg-white/5" />
            </div>
          </div>
          <div className="grid gap-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-6 md:p-10">
        <div className="mb-6 flex items-center gap-3 text-sm text-white/60">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Förbereder teckningen…
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      </section>
    </div>
  );
}
