export default function OpsSourceNotice() {
  return (
    <aside className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm text-amber-50">
      <p>Den här sidan hanterar lokala inställningar och historik. Elavtal och priser som visas för kunder publiceras i OPS.</p>
      <a href="https://app.gridex.se/admin/pricing" className="mt-2 inline-block font-medium underline underline-offset-4">
        Öppna prishanteringen i OPS
      </a>
    </aside>
  )
}
