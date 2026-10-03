import type { ReactNode } from 'react'
export const field = 'mt-1 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2.5 text-sm text-white focus:border-cyan-300'
export const primary = 'rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
export const secondary = 'rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
export const panel = 'rounded-2xl border border-white/10 bg-[var(--gx-surface)] p-4 sm:p-6'
export function Feedback({ error, notice }: { error?: string | null; notice?: string | null }) {
  return <>{error && <p role="alert" className="my-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}{notice && <p role="status" className="my-3 rounded-xl bg-emerald-300/10 p-3 text-sm text-emerald-100">{notice}</p>}</>
}
export function Value({ label, children }: { label: string; children?: ReactNode }) { return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm">{children || '–'}</dd></div> }
export function PageControls({ page, label }: { page: { cursor: string | null; loading: boolean; error: string | null; more: () => void; refresh: () => void }; label: string }) {
  return <><Feedback error={page.error} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondary} disabled={page.loading} onClick={page.refresh}>Uppdatera {label}</button>{page.cursor && <button type="button" className={secondary} disabled={page.loading} onClick={page.more}>Visa fler {label}</button>}{page.loading && <p role="status" className="self-center text-sm text-slate-400">Hämtar {label}…</p>}</div></>
}
