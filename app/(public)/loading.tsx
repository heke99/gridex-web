export default function PublicLoading() {
  return (
    <div
      className="mx-auto min-h-[34vh] w-full max-w-6xl px-6 py-8 md:py-10"
      aria-live="polite"
      aria-busy="true"
      aria-label="Laddar sidan"
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400/70" />
      </div>
      <div className="mt-8 max-w-xl space-y-3">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  )
}
