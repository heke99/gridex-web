import { retryAfterMilliseconds } from '@/lib/ops/httpSafety'

const REFRESH_INTERVAL = 60_000
const MAX_BACKOFF = 5 * REFRESH_INTERVAL
const MAX_TIMER_DELAY = 2_147_483_647
const TERMINAL_ERRORS = [400, 401, 403, 404, 410]

export function pollReceiptStatus<Status>(
  url: string,
  receiveStatus: (status: Status) => boolean | null,
  receiveFailure?: () => void,
): () => void {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight = false
  let failures = 0
  let nextPoll = performance.now()

  function resume() {
    clearTimeout(timer)
    if (controller.signal.aborted || inFlight || document.hidden || !navigator.onLine) return
    const remaining = nextPoll - performance.now()
    if (remaining > 0) timer = setTimeout(resume, Math.min(MAX_TIMER_DELAY, Math.ceil(remaining)))
    else void load()
  }

  function stop() {
    controller.abort()
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
  }

  async function load() {
    inFlight = true
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    }).catch(() => null)
    if (controller.signal.aborted) return

    let retryAfter: number | null = null
    if (!response?.ok) {
      receiveFailure?.()
      if (response && TERMINAL_ERRORS.includes(response.status)) {
        stop()
        return
      }
      failures += 1
      retryAfter = retryAfterMilliseconds(response?.headers.get('Retry-After') ?? null)
    } else {
      const payload = await response.json().catch(() => null) as { data?: Status } | null
      if (controller.signal.aborted) return
      if (payload?.data) {
        const terminal = receiveStatus(payload.data)
        if (terminal === true) {
          stop()
          return
        }
        if (terminal === false) failures = 0
      }
    }

    const backoff = Math.min(MAX_BACKOFF, REFRESH_INTERVAL * 2 ** failures)
    nextPoll = performance.now() + Math.max(backoff, retryAfter ?? 0)
    inFlight = false
    resume()
  }

  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  resume()
  return stop
}
