import { z } from 'zod'

const timestamp = z.union([z.iso.date(), z.iso.datetime({ offset: true })])
const schema = z.strictObject({
  from: timestamp.optional(),
  to: timestamp.optional(),
  facility_id: z.string().regex(/^\d{1,32}$/).optional(),
  cursor: z.string().min(1).max(2048).refine(value => value.trim() === value).optional(),
  limit: z.string().regex(/^(?:[1-9]\d?|100)$/).optional(),
})

export function validMeteringQuery(query: URLSearchParams): boolean {
  const entries = Object.fromEntries(query)
  if (Object.keys(entries).length !== query.size) return false
  const result = schema.safeParse(entries)
  if (!result.success) return false
  const { from, to } = result.data
  return !from || !to || Date.parse(from) <= Date.parse(to)
}
