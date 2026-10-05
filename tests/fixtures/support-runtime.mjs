/** Offline-only backend boundary. Production application code never imports this file. */
import { readFileSync } from 'node:fs'
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

export const FIXTURE_COMPANY = 'b3ad1bf6-fa45-41a6-8054-2e0862e82aca'
export const FIXTURE_CASE = 'case_aaaaaaaaaaaaaaaaaaaaaaaa'
export const FIXTURE_CUSTOMER = 'customer_aaaaaaaaaaaaaaaaaaaaaaaa'
export const FIXTURE_ATTACHMENT = 'attachment_aaaaaaaaaaaaaaaaaaaaaaaa'
export const FIXTURE_ADMIN = '11111111-1111-4111-8111-111111111111'
export const FIXTURE_READER = '22222222-2222-4222-8222-222222222222'
export const FIXTURE_FOREIGN = '33333333-3333-4333-8333-333333333333'
export const FIXTURE_PASSWORD = 'SupportFixture!234'
const PROJECT_REF = 'ayiuxjlfazkjmmtlvhsl'
const AUTH_ORIGIN = 'https://ayiuxjlfazkjmmtlvhsl.supabase.co'
const STAFF_ORIGIN = 'https://app.gridex.se'
const schema = JSON.parse(readFileSync(new URL('../../lib/staff-api/contract.json', import.meta.url), 'utf8')).components
const ajv = new Ajv({ strict: false, allowUnionTypes: true }); addFormats(ajv)
const validators = new Map()
function valid(name, body) {
  if (!validators.has(name)) validators.set(name, ajv.compile({ $ref: `#/components/schemas/${name}`, components: schema }))
  return validators.get(name)(body)
}
const clone = value => JSON.parse(JSON.stringify(value))
const role = (key, label, permissions) => ({ key, label, description: 'Synthetic offline fixture role', permissions, assignable: true })

export function createSupportRuntime(settings) {
  if (!settings.apiKey?.startsWith('support-test-') || settings.companyId !== FIXTURE_COMPANY || !settings.issuer || !settings.audience || !settings.keyId) throw new Error('Offline support fixture configuration required')
  const publicKey = createPublicKey(settings.publicKey)
  if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 2048) throw new Error('Offline RSA fixture public key required')
  const now = () => new Date().toISOString()
  let sequence = 0
  const roles = [role('company_admin', 'Bolagsadministratör', ['cases.read', 'cases.write', 'customers.read', 'customers.write', 'users.read', 'users.write']), role('customer_service_agent', 'Kundtjänst', ['cases.read', 'cases.write', 'customers.read']), role('customer_service_viewer', 'Läsbehörig kundtjänst', ['cases.read'])]
  const user = (id, email, name, key, company = FIXTURE_COMPANY) => ({ id, email, password: FIXTURE_PASSWORD, company, user_metadata: {}, role_key: key, full_name: name, status: 'active' })
  const users = new Map([
    [FIXTURE_ADMIN, user(FIXTURE_ADMIN, 'support@example.invalid', 'Supportadministratör', 'company_admin')],
    [FIXTURE_READER, user(FIXTURE_READER, 'readonly@example.invalid', 'Läsbehörig personal', 'customer_service_viewer')],
    [FIXTURE_FOREIGN, user(FIXTURE_FOREIGN, 'foreign@example.invalid', 'Annan organisation', 'company_admin', '44444444-4444-4444-8444-444444444444')],
  ])
  const embedded = () => ({ limit: 100, returned: 0, has_more: false })
  const customer = { customer_reference: FIXTURE_CUSTOMER, customer_number: 'TEST-1001', customer_type: 'private', status: 'active', display_name: 'Anna Testkund', first_name: 'Anna', last_name: 'Testkund', company_name: null, email: 'anna@example.invalid', phone: '+46 70 111 22 33', personal_number_masked: '1980••••-••••', org_number_masked: null, created_at: now(), invoice_email: 'anna@example.invalid', preferred_language: 'sv', apartment_number: null, updated_at: now(), contacts: [], addresses: [], sites: [], contacts_page: embedded(), addresses_page: embedded(), sites_page: embedded() }
  const supportCase = { case_reference: FIXTURE_CASE, customer_reference: FIXTURE_CUSTOMER, title: 'Inkommande kundärende', description: 'Kunden behöver hjälp med sin faktura.', status: 'open', priority: 'normal', category: 'faktura', assignee_user_id: null, channel: 'customer_portal', created_at: now(), updated_at: now(), resolved_at: null, closed_at: null }
  const cases = new Map([[FIXTURE_CASE, supportCase]])
  const events = new Map([[FIXTURE_CASE, []]])
  const bytes = Buffer.from('%PDF-1.7\nOffline support fixture\n%%EOF')
  const attachment = { attachment_reference: FIXTURE_ATTACHMENT, file_name: 'syntetisk-bilaga.pdf', mime_type: 'application/pdf', byte_size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), uploaded_by: 'customer', created_at: now(), visibility: 'customer', scan_status: 'released', scan_reason: null }
  const traffic = []; const assertions = new Set(); const tokens = new Map(); const refresh = new Map(); const idempotent = new Map()
  const authUser = u => ({ id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', user_metadata: clone(u.user_metadata), app_metadata: {}, identities: [], created_at: '2026-10-05T09:00:00Z' })
  function authSession(u) {
    const access = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: u.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.${Buffer.from(randomUUID()).toString('base64url')}`
    const refreshToken = `offline-refresh-${randomUUID()}`; tokens.set(access, u.id); refresh.set(refreshToken, u.id)
    return { access_token: access, refresh_token: refreshToken, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: authUser(u) }
  }
  function json(data, status = 200, raw = false) {
    const request = randomUUID()
    return new Response(JSON.stringify(raw ? data : { data, request_id: request, contract_schema_version: '2026-10-04.1' }), { status, headers: { 'content-type': 'application/json', 'x-request-id': request, 'x-gridex-contract-version': '2026-10-04.1', 'x-gridex-project-ref': PROJECT_REF, 'cache-control': 'private, no-store' } })
  }
  const failure = (status, code) => json({ error: { code, message: 'Synthetic offline boundary rejection', retryable: false, field: null, blockers: [] }, request_id: randomUUID(), correlation_id: randomUUID(), contract_schema_version: '2026-10-04.1' }, status, true)
  function collection(items, url) {
    const limit = Number(url.searchParams.get('limit') ?? 50)
    const raw = url.searchParams.get('cursor'); const start = raw ? Number(raw.replace(/^offline-page-/, '')) : 0
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(start) || start < 0) return failure(422, 'invalid_request')
    const data = items.slice(start, start + limit); const more = start + data.length < items.length
    return json({ data, page: { limit, offset: 0, returned: data.length, has_more: more, next_cursor: more ? `offline-page-${start + data.length}` : null }, request_id: randomUUID(), contract_schema_version: '2026-10-04.1' }, 200, true)
  }
  const actorState = u => ({ user_id: u.id, role_key: u.role_key, membership_role: 'member', status: u.status })
  const account = u => ({ ...actorState(u), email: u.email, full_name: u.full_name, invited_at: null, accepted_at: '2026-10-05T09:00:00Z', disabled_at: u.status === 'disabled' ? now() : null })
  function addEvent(ref, actor, type, message, extra = {}) {
    const event = { event_reference: `event_${String(++sequence).padStart(24, '0')}`, event_type: type, message, visibility: type === 'support_staff_reply' ? 'customer' : 'internal', author_type: 'staff', author_user_id: actor.id, channel: 'staff_api', kind: type === 'support_staff_reply' ? 'message' : type === 'support_phone_interaction' ? 'phone_summary' : null, direction: null, verification_method: null, verification_reference: null, representative: null, created_at: now(), ...extra }
    events.get(ref).push(event); cases.get(ref).updated_at = now(); return event
  }
  addEvent(FIXTURE_CASE, users.get(FIXTURE_ADMIN), 'created', 'Kundärendet har kommit in.')
  addEvent(FIXTURE_CASE, users.get(FIXTURE_ADMIN), 'support_staff_reply', 'Vi undersöker din fråga.')

  async function fetchBoundary(input, init = {}) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (url.origin === AUTH_ORIGIN && ['/auth/v1/token', '/auth/v1/user', '/auth/v1/logout'].includes(url.pathname)) {
      traffic.push({ boundary: 'auth', method, path: url.pathname })
      let body = {}; try { body = init.body ? JSON.parse(String(init.body)) : {} } catch { return json({ msg: 'Invalid fixture body' }, 400, true) }
      if (url.pathname === '/auth/v1/token' && method === 'POST') {
        const u = url.searchParams.get('grant_type') === 'refresh_token' ? users.get(refresh.get(body.refresh_token)) : [...users.values()].find(u => u.email === body.email && u.password === body.password)
        return u ? json(authSession(u), 200, true) : json({ error_code: 'invalid_credentials', msg: 'Invalid offline credentials' }, 400, true)
      }
      const token = headers.get('authorization')?.replace(/^Bearer /, ''); const u = users.get(tokens.get(token))
      if (!u) return json({ error_code: 'bad_jwt', msg: 'Invalid offline session' }, 401, true)
      if (url.pathname === '/auth/v1/logout' && method === 'POST') { tokens.delete(token); return new Response(null, { status: 204 }) }
      if (url.pathname === '/auth/v1/user' && method === 'GET') return json(authUser(u), 200, true)
      if (url.pathname === '/auth/v1/user' && method === 'PUT') { if (body.password) u.password = body.password; if (body.data) u.user_metadata = { ...u.user_metadata, ...body.data }; return json(authUser(u), 200, true) }
      return json({ msg: 'Unsupported offline Auth route' }, 404, true)
    }
    if (url.origin !== STAFF_ORIGIN || !url.pathname.startsWith('/api/v1/staff/')) throw new Error('Offline support fixture blocked unexpected outbound request')
    if (headers.get('x-gridex-expected-project-ref') !== PROJECT_REF) return failure(412, 'staff_storage_target_mismatch')
    if (headers.get('authorization') !== `Bearer ${settings.apiKey}`) return failure(401, 'api_key_invalid')
    let claims; let actor
    try {
      const token = headers.get('x-gridex-staff-assertion'); const [head, body, signature, extra] = token.split('.')
      const header = JSON.parse(Buffer.from(head, 'base64url')); claims = JSON.parse(Buffer.from(body, 'base64url'))
      if (extra || header.typ !== 'JWT' || header.alg !== 'RS256' || header.kid !== settings.keyId || !verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(signature, 'base64url'))) return failure(401, 'staff_assertion_signature_invalid')
      const seconds = Math.floor(Date.now() / 1000)
      if (claims.iss !== settings.issuer || claims.aud !== settings.audience || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== 60 || claims.iat > seconds + 60 || claims.exp < seconds - 60 || typeof claims.jti !== 'string' || assertions.has(claims.jti)) return failure(401, 'staff_assertion_invalid')
      assertions.add(claims.jti)
      if (claims.company_id !== FIXTURE_COMPANY) return failure(403, 'staff_company_mismatch')
      actor = users.get(claims.sub)
      if (!actor || actor.company !== FIXTURE_COMPANY || actor.status !== 'active') return failure(403, 'staff_membership_inactive')
    } catch { return failure(401, 'staff_assertion_invalid') }
    let payload = {}; try { payload = init.body ? JSON.parse(String(init.body)) : {} } catch { return failure(422, 'invalid_request') }
    const path = url.pathname.slice('/api/v1/staff'.length)
    traffic.push({ boundary: 'staff', method, path, actor: actor.id, company: claims.company_id, idempotencyKey: headers.get('idempotency-key'), payload: clone(payload) })
    const permissions = roles.find(r => r.key === actor.role_key)?.permissions ?? []
    const group = path.startsWith('/users') || path === '/roles' ? 'users' : path.startsWith('/customers') ? 'customers' : 'cases'
    const required = `${group}.${method === 'GET' ? 'read' : 'write'}`
    if (!permissions.includes(required)) return failure(403, 'staff_permission_denied')
    const rawKey = headers.get('idempotency-key'); const replayKey = `${actor.id}|${method}|${path}|${rawKey}`
    if (method !== 'GET') {
      if (!rawKey) return failure(400, 'idempotency_key_required')
      if (idempotent.has(replayKey)) { const old = idempotent.get(replayKey); return old.body === JSON.stringify(payload) ? json(old.data, old.status) : failure(409, 'idempotency_conflict') }
    }
    const done = (data, status = 200) => { if (method !== 'GET') idempotent.set(replayKey, { body: JSON.stringify(payload), data: clone(data), status }); return json(data, status) }
    if (path === '/roles' && method === 'GET') return done(roles)
    if (path === '/users' && method === 'GET') return json({ data: [...users.values()].filter(u => u.company === FIXTURE_COMPANY).map(account), pagination: { page: 1, page_size: 25, total: 2, has_more: false }, request_id: randomUUID(), contract_schema_version: '2026-10-04.1' }, 200, true)
    if (path === '/users' && method === 'POST') {
      if (!valid('StaffInviteRequest', payload)) return failure(422, 'invalid_request')
      if (!roles.some(r => r.key === payload.role_key)) return failure(403, 'staff_role_ceiling')
      return done({ email: payload.email, role_key: payload.role_key, membership_role: 'member', status: 'pending' }, 201)
    }
    const userPath = path.match(/^\/users\/([0-9a-f-]+)(?:\/(disable|enable))?$/)
    if (userPath) {
      const target = users.get(userPath[1]); if (!target || target.company !== FIXTURE_COMPANY) return failure(404, 'staff_not_found')
      const operation = userPath[2]
      if (operation === 'disable' && method === 'POST') { if (!valid('StaffDisableRequest', payload)) return failure(422, 'invalid_request'); if (target.id === actor.id) return failure(409, 'staff_self_disable'); target.status = 'disabled' }
      else if (operation === 'enable' && method === 'POST') { if (!valid('StaffEnableRequest', payload)) return failure(422, 'invalid_request'); target.status = 'active' }
      else if (!operation && method === 'PATCH') { if (!valid('StaffRoleChangeRequest', payload)) return failure(422, 'invalid_request'); if (!roles.some(r => r.key === payload.role_key)) return failure(403, 'staff_role_ceiling'); if (target.id === actor.id && target.role_key === 'company_admin' && payload.role_key !== 'company_admin') return failure(409, 'last_admin_guard'); target.role_key = payload.role_key }
      else return failure(404, 'offline_route_not_found')
      return done(actorState(target))
    }
    if (path === '/customers' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase(); const customers = customer.display_name.toLowerCase().includes(q) ? [clone(customer)] : []
      const keys = schema.schemas.StaffCustomerSummary.required
      return done({ customers: customers.map(c => Object.fromEntries(keys.map(k => [k, c[k]]))), pagination: { page: Number(url.searchParams.get('page') ?? 1), page_size: 25, total: customers.length, total_pages: customers.length ? 1 : 0 } })
    }
    if (path === `/customers/${FIXTURE_CUSTOMER}` && method === 'GET') return done({ customer })
    if (path === `/customers/${FIXTURE_CUSTOMER}/contact` && method === 'PATCH') {
      if (!valid('StaffContactChangeRequest', payload)) return failure(422, 'invalid_request')
      if (payload.expectedUpdatedAt !== customer.updated_at) return failure(409, 'version_conflict')
      for (const field of ['email', 'phone', 'invoice_email', 'preferred_language', 'apartment_number']) if (Object.hasOwn(payload, field)) customer[field] = payload[field]
      customer.updated_at = new Date(Date.now() + ++sequence).toISOString()
      return done({ customer_reference: FIXTURE_CUSTOMER, changed: true, customer_updated_at: customer.updated_at })
    }
    if (path === `/customers/${FIXTURE_CUSTOMER}/identity-change` && method === 'POST') {
      if (!valid('StaffIdentityChangeRequest', payload)) return failure(422, 'invalid_request')
      return done({ request_reference: `identity_${String(++sequence).padStart(24, '0')}`, status: 'pending_customer_approval', recipient_masked: 'a***@example.invalid', expires_at: null, contract_count: 1, takeover_required: false }, 201)
    }
    if (path === '/cases' && method === 'GET') {
      let rows = [...cases.values()]; const status = url.searchParams.get('status'); const query = url.searchParams.get('query')?.toLowerCase(); const owner = url.searchParams.get('customer_reference')
      if (status) rows = rows.filter(c => c.status === status); if (query) rows = rows.filter(c => c.title.toLowerCase().includes(query)); if (owner) rows = rows.filter(c => c.customer_reference === owner)
      return collection(rows, url)
    }
    if (path === '/cases' && method === 'POST') {
      if (!valid('StaffCaseCreateRequest', payload)) return failure(422, 'invalid_request')
      if (payload.customer_reference !== FIXTURE_CUSTOMER) return failure(404, 'customer_not_found')
      const ref = `case_${String(++sequence).padStart(24, '0')}`; const result = { ...supportCase, case_reference: ref, ...payload, status: 'open', priority: payload.priority ?? 'normal', category: payload.category ?? null, description: payload.description ?? null, assignee_user_id: null, channel: 'staff_api', created_at: now(), updated_at: now(), resolved_at: null, closed_at: null }
      cases.set(ref, result); events.set(ref, []); addEvent(ref, actor, 'created', 'Ärendet skapades.'); return done(result, 201)
    }
    const casePath = path.match(/^\/cases\/([^/]+)(?:\/(.*))?$/)
    if (casePath) {
      const ref = casePath[1]; const current = cases.get(ref); if (!current) return failure(404, 'support_case_not_found')
      const operation = casePath[2]
      if (!operation && method === 'GET') return done({ ...current, events: events.get(ref), attachments: ref === FIXTURE_CASE ? [attachment] : [], events_page: { limit: 50, offset: 0, returned: events.get(ref).length, has_more: false, next_cursor: null }, attachments_page: { limit: 50, offset: 0, returned: ref === FIXTURE_CASE ? 1 : 0, has_more: false, next_cursor: null } })
      if (operation === 'events' && method === 'GET') return collection(events.get(ref), url)
      if (operation === 'attachments' && method === 'GET') return collection(ref === FIXTURE_CASE ? [attachment] : [], url)
      if (operation === `attachments/${FIXTURE_ATTACHMENT}/file` && ref === FIXTURE_CASE && method === 'GET') return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': "attachment; filename*=UTF-8''syntetisk-bilaga.pdf", 'x-gridex-sha256': attachment.sha256, 'x-gridex-project-ref': PROJECT_REF, 'x-request-id': randomUUID() } })
      const requestSchema = { messages: 'StaffMessageRequest', notes: 'StaffNoteRequest', 'phone-interactions': 'StaffPhoneRequest', status: 'StaffStatusRequest', assignee: 'StaffAssigneeRequest' }[operation]
      if (!requestSchema || !valid(requestSchema, payload)) return failure(422, 'invalid_request')
      if (['messages', 'notes', 'phone-interactions'].includes(operation) && method === 'POST') {
        const type = { messages: 'support_staff_reply', notes: 'support_internal_note', 'phone-interactions': 'support_phone_interaction' }[operation]
        return done(addEvent(ref, actor, type, payload.message ?? payload.summary, operation === 'phone-interactions' ? { direction: payload.direction, verification_method: payload.verification_method, verification_reference: payload.verification_reference ?? null } : {}), 201)
      }
      if (operation === 'status' && method === 'PATCH') { current.status = payload.status; current.resolved_at = payload.status === 'resolved' ? now() : null; current.closed_at = payload.status === 'closed' ? now() : null; addEvent(ref, actor, 'status_changed', `Status: ${payload.status}`); return done(current) }
      if (operation === 'assignee' && method === 'PATCH') { const target = payload.assignee_user_id && users.get(payload.assignee_user_id); if (payload.assignee_user_id && (!target || target.company !== FIXTURE_COMPANY || target.status !== 'active')) return failure(422, 'staff_assignee_invalid'); current.assignee_user_id = payload.assignee_user_id; addEvent(ref, actor, 'assigned', 'Tilldelningen ändrades.'); return done(current) }
    }
    return failure(404, 'offline_route_not_found')
  }
  return { fetch: fetchBoundary, state: { traffic, users, cases, events, customer, assertions }, authSession: id => authSession(users.get(id)) }
}

if (process.env.SUPPORT_TEST_MODE === '1') {
  const publicKey = process.env.SUPPORT_TEST_PUBLIC_KEY ?? (process.env.SUPPORT_TEST_PUBLIC_KEY_FILE && readFileSync(process.env.SUPPORT_TEST_PUBLIC_KEY_FILE, 'utf8'))
  const runtime = createSupportRuntime({ apiKey: process.env.GRIDEX_STAFF_API_KEY, companyId: process.env.GRIDEX_STAFF_COMPANY_ID, issuer: process.env.GRIDEX_STAFF_ASSERTION_ISSUER, audience: process.env.GRIDEX_STAFF_ASSERTION_AUDIENCE, keyId: process.env.GRIDEX_STAFF_ASSERTION_KID, publicKey })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (['http://127.0.0.1', 'http://localhost', 'http://[::1]'].some(origin => url.origin === origin || url.origin.startsWith(`${origin}:`))) return originalFetch(input, init)
    return runtime.fetch(input, init)
  }
  globalThis.__supportRuntime = runtime
}
