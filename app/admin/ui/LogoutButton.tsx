'use client'

export default function LogoutButton() {
  return (
    <a
      href="/logout"
      className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-black hover:bg-white/90"
    >
      Logga ut
    </a>
  )
}