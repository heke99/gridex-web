import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`${label}: anchor missing`)
  return source.replace(from, to)
}

const pagePath = 'app/(public)/teckna-avtal/page.tsx'
let page = await readFile(pagePath, 'utf8')
page = replaceOnce(
  page,
  `    case "portal_auth_required":\n      return "Du behöver logga in eller skapa ett verifierat konto innan elavtalet kan tecknas.";`,
  `    case "portal_auth_required":\n      return "Kundansökan kunde inte verifieras mot Gridex just nu. Försök igen eller kontakta kundservice.";`,
  'portal auth error copy',
)
page = replaceOnce(
  page,
  `  const canSubmit =\n    status.configured &&\n    status.liveSignupEnabled &&\n    !loadError &&\n    contracts.length > 0 &&\n    currentAuth !== null;`,
  `  const canSubmit =\n    status.configured &&\n    status.liveSignupEnabled &&\n    !loadError &&\n    contracts.length > 0;`,
  'checkout submit auth gate',
)
page = replaceOnce(
  page,
  `    const currentAuth = await getCurrentPortalAuth();\n    if (!currentAuth) {\n      return fail('portal_auth_required', {\n        step: 0,\n        fieldErrors: {\n          form: 'Logga in eller skapa ett verifierat konto innan du fortsätter.',\n        },\n      });\n    }\n    const authenticatedEmailMismatch = Boolean(\n      currentAuth?.email && !sameEmail(currentAuth.email, email),\n    );`,
  `    const currentAuth = await getCurrentPortalAuth();\n    const authenticatedEmailMismatch = Boolean(\n      currentAuth?.email && !sameEmail(currentAuth.email, email),\n    );`,
  'server-side auth gate',
)
page = replaceOnce(
  page,
  `    const linkedAuthUserId = currentAuth.id;\n    const externalCustomerId =\n      currentAuth.externalCustomerId ??`,
  `    const linkedAuthUserId = currentAuth?.id ?? null;\n    const externalCustomerId =\n      currentAuth?.externalCustomerId ??`,
  'optional linked auth user',
)
page = replaceOnce(
  page,
  `      customer_portal_user_id: linkedAuthUserId,\n      auth_user_id: linkedAuthUserId,\n      idempotency_key: idempotencyKey,`,
  `      ...(linkedAuthUserId\n        ? {\n            customer_portal_user_id: linkedAuthUserId,\n            auth_user_id: linkedAuthUserId,\n          }\n        : {}),\n      idempotency_key: idempotencyKey,`,
  'optional portal identity payload',
)
await writeFile(pagePath, page)
console.log(`updated ${pagePath}`)

const formPath = 'components/signup/CustomerApplicationForm.tsx'
let form = await readFile(formPath, 'utf8')
form = replaceOnce(
  form,
  `      {authenticationRequired ? (\n        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-50" role="status">\n          <div className="font-semibold">Verifierat konto krävs för att teckna</div>\n          <p className="mt-2 leading-6 text-cyan-50/80">\n            Den aktuella Gridex-API-versionen kräver att ansökan kopplas till samma verifierade användare i Mina sidor redan när avtalet skickas. Din påbörjade teckning bevaras när du loggar in.\n          </p>\n          <div className="mt-4 flex flex-wrap gap-3">\n            <Link\n              href={\`/login?next=\${encodeURIComponent(authenticationReturnPath)}\`}\n              className="inline-flex rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-black transition hover:bg-cyan-300"\n            >\n              Logga in och fortsätt\n            </Link>\n            <Link\n              href={\`/register?next=\${encodeURIComponent(authenticationReturnPath)}\`}\n              className="inline-flex rounded-xl border border-cyan-200/30 px-4 py-2 font-semibold text-cyan-50 transition hover:bg-white/10"\n            >\n              Skapa konto\n            </Link>\n          </div>\n        </div>\n      ) : null}`,
  `      {authenticationRequired ? (\n        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-50" role="status">\n          <div className="font-semibold">Mina sidor kan aktiveras efter teckningen</div>\n          <p className="mt-2 leading-6 text-cyan-50/80">\n            Du behöver inte ha ett konto för att teckna elavtal. Efter en godkänd teckning skickar Gridex en säker länk till e-postadressen i ansökan så att du kan aktivera Mina sidor och se dina uppgifter.\n          </p>\n          <div className="mt-4 flex flex-wrap gap-3">\n            <Link\n              href={\`/login?next=\${encodeURIComponent(authenticationReturnPath)}\`}\n              className="inline-flex rounded-xl border border-cyan-200/30 px-4 py-2 font-semibold text-cyan-50 transition hover:bg-white/10"\n            >\n              Jag har redan ett konto\n            </Link>\n          </div>\n        </div>\n      ) : null}`,
  'non-blocking portal onboarding copy',
)
await writeFile(formPath, form)
console.log(`updated ${formPath}`)

const typesPath = 'lib/ops/client/types.ts'
let types = await readFile(typesPath, 'utf8')
types = replaceOnce(
  types,
  `  customer_portal_user_id: string;\n  auth_user_id: string;`,
  `  customer_portal_user_id?: string;\n  auth_user_id?: string;`,
  'optional application portal IDs',
)
await writeFile(typesPath, types)
console.log(`updated ${typesPath}`)

const applicationPath = 'lib/ops/client/application.ts'
let application = await readFile(applicationPath, 'utf8')
const oldPortalValidation = `  const customerPortalUserId = normalizeText(input.customer_portal_user_id)
  const authUserId = normalizeText(input.auth_user_id)
  if (!customerPortalUserId || !authUserId) {
    throw new OpsError('Verifierad portalidentitet krävs innan kundansökan kan skickas.', 400, {
      code: 'customer_portal_identity_required',
      field: !customerPortalUserId ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(customerPortalUserId) || !uuidPattern.test(authUserId)) {
    throw new OpsError('Portalidentiteten måste vara ett giltigt användar-UUID.', 400, {
      code: 'customer_portal_identity_invalid',
      field: !uuidPattern.test(customerPortalUserId) ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  if (customerPortalUserId !== authUserId) {
    throw new OpsError('Portalidentiteten måste innehålla samma verifierade användar-ID i båda fälten.', 400, {
      code: 'customer_portal_identity_mismatch',
      field: 'auth_user_id',
      retryable: false,
    })
  }
  const portalIdentitySupported =
    websiteSchemaHasProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaHasProperty('CustomerApplicationRequest', 'auth_user_id') &&
    websiteSchemaRequiresProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaRequiresProperty('CustomerApplicationRequest', 'auth_user_id')
  if (!portalIdentitySupported) {
    throw new OpsError('OPS OpenAPI saknar stöd för atomisk Mina sidor-koppling i kundansökan.', 503, {
      code: 'ops_customer_application_portal_identity_contract_unsupported',
      endpoint: '/api/v1/website/customer-applications',
      contract_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      retryable: false,
    })
  }`
const newPortalValidation = `  const customerPortalUserId = normalizeText(input.customer_portal_user_id)
  const authUserId = normalizeText(input.auth_user_id)
  const hasCustomerPortalUserId = Boolean(customerPortalUserId)
  const hasAuthUserId = Boolean(authUserId)
  if (hasCustomerPortalUserId !== hasAuthUserId) {
    throw new OpsError('Portalidentiteten måste skickas som ett komplett ID-par eller utelämnas helt.', 400, {
      code: 'customer_portal_identity_mismatch',
      field: !customerPortalUserId ? 'customer_portal_user_id' : 'auth_user_id',
      retryable: false,
    })
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (customerPortalUserId && authUserId) {
    if (!uuidPattern.test(customerPortalUserId) || !uuidPattern.test(authUserId)) {
      throw new OpsError('Portalidentiteten måste vara ett giltigt användar-UUID.', 400, {
        code: 'customer_portal_identity_invalid',
        field: !uuidPattern.test(customerPortalUserId) ? 'customer_portal_user_id' : 'auth_user_id',
        retryable: false,
      })
    }
    if (customerPortalUserId !== authUserId) {
      throw new OpsError('Portalidentiteten måste innehålla samma verifierade användar-ID i båda fälten.', 400, {
        code: 'customer_portal_identity_mismatch',
        field: 'auth_user_id',
        retryable: false,
      })
    }
  }
  const portalIdentitySupported =
    websiteSchemaHasProperty('CustomerApplicationRequest', 'customer_portal_user_id') &&
    websiteSchemaHasProperty('CustomerApplicationRequest', 'auth_user_id')
  if (!portalIdentitySupported) {
    throw new OpsError('OPS OpenAPI saknar stöd för Mina sidor-identitet i kundansökan.', 503, {
      code: 'ops_customer_application_portal_identity_contract_unsupported',
      endpoint: '/api/v1/website/customer-applications',
      contract_version: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      retryable: false,
    })
  }`
application = replaceOnce(application, oldPortalValidation, newPortalValidation, 'OPS client portal pair validation')
application = replaceOnce(
  application,
  `    customer_portal_user_id: customerPortalUserId,\n    auth_user_id: authUserId,\n    customer: {`,
  `    ...(customerPortalUserId && authUserId\n      ? { customer_portal_user_id: customerPortalUserId, auth_user_id: authUserId }\n      : {}),\n    customer: {`,
  'OPS application optional portal payload',
)
await writeFile(applicationPath, application)
console.log(`updated ${applicationPath}`)

const oldVersion = '2026-08-20.1'
const newVersion = '2026-08-20.2'
function rewriteVersion(value) {
  if (Array.isArray(value)) return value.map(rewriteVersion)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteVersion(child)]))
  }
  return value === oldVersion ? newVersion : value
}

for (const specPath of ['docs/openapi/website-integration-v1.json', 'docs/openapi/customer-portal-v1.json']) {
  let spec = rewriteVersion(JSON.parse(await readFile(specPath, 'utf8')))
  if (specPath.endsWith('website-integration-v1.json')) {
    const schema = spec.components.schemas.CustomerApplicationRequest
    schema.required = (schema.required ?? []).filter(
      (field) => field !== 'auth_user_id' && field !== 'customer_portal_user_id',
    )
    schema.dependentRequired = {
      ...(schema.dependentRequired ?? {}),
      auth_user_id: ['customer_portal_user_id'],
      customer_portal_user_id: ['auth_user_id'],
    }
    schema.description =
      'Customer application for one authenticated tenant API client. auth_user_id and customer_portal_user_id are optional as a pair when the tenant policy is post_auth_allowed; when either is supplied both must be the same verified UUID.'
    schema.properties.auth_user_id.description =
      'Optional verified tenant-portal auth UUID. Must be supplied together with customer_portal_user_id and must match it.'
    schema.properties.customer_portal_user_id.description =
      'Optional verified tenant-portal user UUID. Must be supplied together with auth_user_id and must match it.'
  }
  await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`)
  console.log(`updated ${specPath}`)
}

const websiteBytes = await readFile('docs/openapi/website-integration-v1.json')
const portalBytes = await readFile('docs/openapi/customer-portal-v1.json')
const websiteSha = createHash('sha256').update(websiteBytes).digest('hex')
const portalSha = createHash('sha256').update(portalBytes).digest('hex')
const contractPath = 'lib/ops/contract.ts'
let contract = await readFile(contractPath, 'utf8')
contract = contract.replaceAll(`'${oldVersion}'`, `'${newVersion}'`)
contract = contract.replace(/GRIDEX_WEBSITE_OPENAPI_SHA256 = '[a-f0-9]{64}'/, `GRIDEX_WEBSITE_OPENAPI_SHA256 = '${websiteSha}'`)
contract = contract.replace(/GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = '[a-f0-9]{64}'/, `GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = '${portalSha}'`)
await writeFile(contractPath, contract)
console.log(`updated ${contractPath}`)
