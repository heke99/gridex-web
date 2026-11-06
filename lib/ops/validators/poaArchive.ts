import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import document from '@/docs/openapi/poa-archive-v1.json'
import { OpsError, OpsSchemaError } from '@/lib/ops/errors'

const root = 'gridex-independent-poa-archive'
const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true })
addFormats(ajv)
ajv.addSchema(document, root)
type Row = Record<string, unknown>
const spec = document as unknown as { paths: Record<string, { get: { parameters: Row[] } }>; components: { parameters: Record<string, Row> } }
const validators = {
  list: ajv.getSchema(`${root}#/components/schemas/CustomerPoaArchiveListEnvelope`)!,
  detail: ajv.getSchema(`${root}#/components/schemas/CustomerPoaArchiveVerificationEnvelope`)!,
}
export const POA_ARCHIVE_PATH = '/api/v1/customer/powers-of-attorney/evidence'

export function assertPoaArchiveResponse(value: unknown, kind: keyof typeof validators): void {
  const validator = validators[kind]
  if (validator(value)) return
  throw new OpsSchemaError({ schema: `poa-archive:${kind}`, stage: 'response', endpoint: POA_ARCHIVE_PATH,
    errors: (validator.errors ?? []).map(e => ({ instancePath: e.instancePath, keyword: e.keyword, message: e.message ?? null })) })
}

/** Validate the actual signed request after the transport has minted its fresh JTI. */
export function assertPoaArchiveRequest(path: string, headers: Headers): void {
  if (!headers.get('x-gridex-customer-assertion')) {
    throw new OpsError('Kundinloggningens verifiering är inte konfigurerad.', 503,
      { code: 'customer_assertion_not_configured', retryable: false })
  }
  const url = new URL(path, 'https://synthetic.invalid')
  const detail = url.pathname !== POA_ARCHIVE_PATH
  const template = detail ? `${POA_ARCHIVE_PATH}/{verificationReference}` : POA_ARCHIVE_PATH
  const parameters = spec.paths[template].get.parameters.map(p => typeof p.$ref === 'string'
    ? spec.components.parameters[p.$ref.split('/').at(-1)!] : p)
  const allowed = new Set(parameters.filter(p => p.in === 'query').map(p => p.name))
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) invalid(key)
  }
  for (const parameter of parameters) {
    const name = String(parameter.name), schema = parameter.schema as Row
    const raw = parameter.in === 'header' ? headers.get(name)
      : parameter.in === 'path' ? decodeURIComponent(url.pathname.slice(POA_ARCHIVE_PATH.length + 1))
        : url.searchParams.get(name)
    if (raw === null || raw === '') { if (parameter.required) invalid(name); continue }
    const value = schema?.type === 'integer' ? (/^[1-9]\d*$/.test(raw) ? Number(raw) : raw) : raw
    if (schema && !ajv.validate(schema, value)) invalid(name)
  }
}

function invalid(field: string): never {
  throw new OpsError('Ogiltig begäran för fullmaktsdokument.', 400, { code: 'invalid_poa_archive_request', field, retryable: false })
}
