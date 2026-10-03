import { createHash } from 'node:crypto'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ValidateFunction } from 'ajv'
import specification from '@/docs/openapi/staff-support-v1.json'
import manifest from '@/docs/openapi/staff-release-manifest.json'
import { OpsError } from '@/lib/ops/errors'
import { STAFF_CONTRACT_VERSION, STAFF_PROTOCOL_CAPABILITIES, staffApiConfig } from './config'
import { readStaffBody } from './boundary'

type Row = Record<string, unknown>
const document = specification as unknown as Row
const paths = document.paths as Record<string, Row>
const root = 'gridex-independent-staff-openapi'
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true, allowUnionTypes: true })
addFormats(ajv)
ajv.addSchema(specification, root)
const compiled = new Map<string, ValidateFunction>()
let readiness: { origin: string; until: number } | null = null

function invalid(stage: 'request' | 'response' | 'release'): never {
  throw new OpsError(stage === 'request' ? 'Begäran följer inte personalportalens API-kontrakt.' : 'Personalportalens API-kontrakt kunde inte verifieras.',
    stage === 'request' ? 400 : stage === 'release' ? 503 : 502, {
      code: `staff_contract_${stage}_invalid`, retryable: false,
    })
}
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('response'); return value as Row }
function pointer(value: string) { return value.replace(/~/g, '~0').replace(/\//g, '~1') }
function schemaValidate(at: string, value: unknown, stage: 'request' | 'response') {
  let validate = compiled.get(at)
  if (!validate) { validate = ajv.getSchema(`${root}#${at}`); if (!validate) invalid(stage); compiled.set(at, validate) }
  if (!validate(value)) invalid(stage)
}
function resolve(value: unknown): { value: Row; at: string | null } {
  let node = row(value)
  let at: string | null = null
  for (let depth = 0; depth < 8 && typeof node.$ref === 'string'; depth++) {
    if (!node.$ref.startsWith('#/')) invalid('response')
    at = node.$ref.slice(1)
    let item: unknown = document
    for (const key of at.slice(1).split('/')) item = row(item)[key.replace(/~1/g, '/').replace(/~0/g, '~')]
    node = row(item)
  }
  if (node.$ref) invalid('response')
  return { value: node, at }
}
function operation(path: string, method: string) {
  const url = new URL(`/api/v1${path}`, 'https://staff.invalid')
  const parts = url.pathname.split('/')
  for (const [candidate, item] of Object.entries(paths)) {
    const template = candidate.split('/')
    if (parts.length !== template.length || !template.every((part, index) => /^\{[^}]+\}$/.test(part) || part === parts[index])) continue
    const value = item[method.toLowerCase()]
    if (!value) invalid('request')
    return { value: row(value), item, url, template, parts, at: `/paths/${pointer(candidate)}/${method.toLowerCase()}` }
  }
  invalid('request')
}

/** No undocumented query, duplicate field or extra JSON property reaches OPS. */
export function assertStaffRequest(path: string, method: string, body?: unknown): void {
  const op = operation(path, method)
  const parameters = [...(Array.isArray(op.item.parameters) ? op.item.parameters.map((raw, index) => ({ raw, at: `${op.at.replace(/\/[^/]+$/, '')}/parameters/${index}` })) : []), ...(Array.isArray(op.value.parameters) ? op.value.parameters.map((raw, index) => ({ raw, at: `${op.at}/parameters/${index}` })) : [])]
  const allowed = new Set<string>()
  for (const item of parameters) {
    const resolved = resolve(item.raw)
    const parameter = resolved.value
    const schemaAt = `${resolved.at ?? item.at}/schema`
    if (parameter.in === 'query') {
      const name = String(parameter.name)
      allowed.add(name)
      const values = op.url.searchParams.getAll(name)
      if (values.length > 1 || (parameter.required && values.length === 0)) invalid('request')
      if (values.length) {
        const schema = row(parameter.schema)
        const rawValue = values[0]!
        const value = schema.type === 'integer' && /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue
        schemaValidate(schemaAt, value, 'request')
      }
    } else if (parameter.in === 'path') {
      const index = op.template.indexOf(`{${String(parameter.name)}}`)
      if (index < 0) invalid('request')
      schemaValidate(schemaAt, op.parts[index], 'request')
    }
  }
  for (const key of op.url.searchParams.keys()) if (!allowed.has(key)) invalid('request')
  if (op.value.requestBody) {
    const resolved = resolve(op.value.requestBody)
    const content = row(resolved.value.content)
    if (content['application/json']) {
      schemaValidate(`${resolved.at ?? `${op.at}/requestBody`}/content/application~1json/schema`, body, 'request')
    } else if (body !== undefined) invalid('request')
  } else if (body !== undefined) invalid('request')
}

export function assertStaffResponse(path: string, method: string, status: number, body: unknown): void {
  const op = operation(path, method)
  const responses = row(op.value.responses)
  const key = Object.hasOwn(responses, String(status)) ? String(status) : 'default'
  if (!responses[key]) invalid('response')
  const resolved = resolve(responses[key])
  const content = row(resolved.value.content)
  if (!content['application/json']) invalid('response')
  schemaValidate(`${resolved.at ?? `${op.at}/responses/${key}`}/content/application~1json/schema`, body, 'response')
  const envelope = row(body)
  if (envelope.page !== undefined) {
    const page = row(envelope.page)
    if (!Array.isArray(envelope.data) || page.returned !== envelope.data.length ||
      Number(page.returned) > Number(page.limit) ||
      (page.has_more === true ? typeof page.next_cursor !== 'string' || !page.next_cursor : page.next_cursor !== null)) invalid('response')
  }
}

async function publicBytes(url: string, maxBytes: number): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(10000)
  const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal, headers: { Accept: 'application/json' } })
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') invalid('release')
  return readStaffBody(response, maxBytes, signal)
}

/** Release capabilities describe protocol coverage, never personal authorization. */
export async function assertStaffProtocolReady(): Promise<void> {
  const { base } = staffApiConfig()
  if (readiness?.origin === base.origin && readiness.until > Date.now()) return
  const expected = manifest as unknown as Row
  const expectedSpec = row(expected.specification)
  if (expected.contract_name !== 'staff-support-v1' || expected.contract_version !== STAFF_CONTRACT_VERSION ||
    typeof expectedSpec.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSpec.sha256) ||
    row(document.info).version !== STAFF_CONTRACT_VERSION || Object.keys(paths).filter((key) => key.startsWith('/api/v1/staff/')).length < 10) invalid('release')
  try {
    const raw = await publicBytes(`${base.origin}/api/v1/openapi/staff-release-manifest.json`, 64 * 1024)
    const received = row(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)))
    const spec = row(received.specification)
    const mutableUrl = `${base.origin}/api/v1/openapi/staff-support-v1.json`
    const immutableUrl = `${base.origin}/api/v1/openapi/${STAFF_CONTRACT_VERSION}/staff-support-v1.json`
    if (received.schema_version !== 1 || received.contract_name !== 'staff-support-v1' || received.contract_version !== STAFF_CONTRACT_VERSION ||
      received.minimum_staff_integration_version !== STAFF_CONTRACT_VERSION || received.guide_version !== STAFF_CONTRACT_VERSION ||
      typeof received.released_at !== 'string' || !Number.isFinite(Date.parse(received.released_at)) ||
      typeof received.build_commit !== 'string' || !/^[a-f0-9]{40}$/.test(received.build_commit) ||
      !Array.isArray(received.capabilities) || !STAFF_PROTOCOL_CAPABILITIES.every((name) => (received.capabilities as unknown[]).includes(name)) ||
      spec.sha256 !== expectedSpec.sha256 || spec.url !== mutableUrl || spec.immutable_url !== immutableUrl) invalid('release')
    for (const url of [mutableUrl, immutableUrl]) {
      const bytes = await publicBytes(url, 2 * 1024 * 1024)
      if (createHash('sha256').update(bytes).digest('hex') !== expectedSpec.sha256 ||
        row(row(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))).info).version !== STAFF_CONTRACT_VERSION) invalid('release')
    }
    readiness = { origin: base.origin, until: Date.now() + 60000 }
  } catch (error) {
    if (error instanceof OpsError && error.code === 'staff_contract_release_invalid') throw error
    invalid('release')
  }
}
