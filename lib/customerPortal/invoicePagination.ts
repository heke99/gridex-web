export function readInvoiceCursor(values: readonly string[]): string | null {
  if (values.length === 0) return null
  const [cursor] = values
  if (values.length !== 1 || !cursor?.trim() || cursor.length > 2048) {
    throw new Error('Invalid invoice cursor')
  }
  return cursor
}

export function customerListPage(payload: unknown, cursor?: string | null) {
  const page = (payload as { page?: { has_more?: unknown; next_cursor?: unknown } } | null)?.page
  if (page === undefined && !cursor) return { hasMore: false, nextCursor: null }
  if (page?.has_more === false) return { hasMore: false, nextCursor: null }
  if (page?.has_more !== true || typeof page.next_cursor !== 'string') {
    throw new Error('Incomplete customer list pagination')
  }
  const nextCursor = readInvoiceCursor([page.next_cursor])
  if (!nextCursor || nextCursor === cursor) throw new Error('Invalid customer list continuation')
  return { hasMore: true, nextCursor }
}
