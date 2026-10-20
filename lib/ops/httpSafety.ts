/** Parse both Retry-After forms without shortening the server's requested wait. */
export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | null {
  if (value === null || !value.trim()) return null
  const input = value.trim()
  if (/^\d+$/.test(input)) return Math.min(Number.MAX_SAFE_INTEGER, Number(input) * 1000)
  // HTTP dates, never negative numbers or other Date.parse shorthand.
  if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(input)) return null
  const timestamp = Date.parse(input)
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null
}

export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error('Request aborted'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}

/** Bound a body read even if a broken upstream/adapter ignores fetch's signal. */
export async function readBoundedBytes(response: Response, maximum: number, signal?: AbortSignal): Promise<Uint8Array> {
  const tooLarge = () => new RangeError('Response exceeds the configured byte limit')
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    void response.body?.cancel().catch(() => undefined)
    throw tooLarge()
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    if (signal?.aborted) { abort(); throw signal.reason }
    while (true) {
      const chunk = await reader.read()
      if (signal?.aborted) throw signal.reason
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maximum) { void reader.cancel().catch(() => undefined); throw tooLarge() }
      chunks.push(chunk.value)
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}
