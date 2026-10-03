'use client'
import { useEffect, useRef, useState } from 'react'
import type { StaffClient } from './client'

/** Each filtered resource has its own continuation, cancellation and error. */
export function useStaffPage<T>(client: StaffClient, path: string | null, key: keyof T) {
  const [rows, setRows] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<{ path: string | null; controller: AbortController; busy: boolean } | null>(null)
  const cursorRef = useRef<string | null>(null)
  function fetchPage(target: string, append: boolean, controller: AbortController) {
    setLoading(true); setError(null)
    const url = new URL(target, 'https://staff.invalid')
    url.searchParams.set('limit', '50')
    if (append && cursorRef.current) url.searchParams.set('cursor', cursorRef.current)
    return client.read<T[]>(`${url.pathname}${url.search}`, controller.signal).then((result) => {
      if (controller.signal.aborted || active.current?.controller !== controller) return
      if (!Array.isArray(result.data) || !result.page || result.page.has_more && !result.page.next_cursor) throw new Error('Sidinformationen är ofullständig. Uppdatera listan.')
      setRows((previous) => append ? [...previous, ...result.data.filter((row) => !previous.some((old) => old[key] === row[key]))] : result.data)
      cursorRef.current = result.page.has_more ? result.page.next_cursor : null
      setCursor(cursorRef.current)
    }).catch((failure) => {
      if (!controller.signal.aborted && active.current?.controller === controller) setError(failure instanceof Error ? failure.message : 'Listan kunde inte hämtas.')
    }).finally(() => {
      if (!controller.signal.aborted && active.current?.controller === controller) { active.current.busy = false; setLoading(false) }
    })
  }
  useEffect(() => {
    const controller = new AbortController()
    active.current = { path, controller, busy: Boolean(path) }
    setRows([]); setCursor(null); cursorRef.current = null; setError(null); setLoading(Boolean(path))
    if (path) void fetchPage(path, false, controller)
    return () => controller.abort()
    // The resource path fully identifies its normalized filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, client])
  function load(append: boolean) {
    const current = active.current
    if (!current?.path || current.busy || append && !cursorRef.current) return
    current.controller.abort()
    const controller = new AbortController()
    active.current = { ...current, controller, busy: true }
    if (!append) { setRows([]); setCursor(null); cursorRef.current = null }
    void fetchPage(current.path, append, controller)
  }
  return { rows, cursor, loading, error, more: () => load(true), refresh: () => load(false) }
}
