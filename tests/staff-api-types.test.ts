import type { StaffContactChangeRequest, StaffApiClient } from '../lib/staff-api/client'

const valid: StaffContactChangeRequest = { expectedUpdatedAt: '2026-10-05T09:00:00Z', phone: null }
// @ts-expect-error Contact mutations require at least one actual changed field.
const noChange: StaffContactChangeRequest = { expectedUpdatedAt: '2026-10-05T09:00:00Z' }
// @ts-expect-error The optimistic version is mandatory.
const noVersion: StaffContactChangeRequest = { email: 'test@example.invalid' }
// @ts-expect-error No actor or company authority can be supplied as contact fields.
const authority: StaffContactChangeRequest = { expectedUpdatedAt: '2026-10-05T09:00:00Z', phone: null, actor_user_id: 'user' }
type EnabledResult = Awaited<ReturnType<StaffApiClient['enableUser']>>
const state = (result: EnabledResult) => result.data.status
void [valid, noChange, noVersion, authority, state]
