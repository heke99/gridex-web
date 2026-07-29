import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  ['docs/openapi/website-integration-v1.json', 'lib/ops/generated/website-api.d.ts'],
  ['docs/openapi/customer-portal-v1.json', 'lib/ops/generated/customer-portal-api.d.ts'],
]

function quoteKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

function refType(ref) {
  const name = String(ref).split('/').at(-1)
  return `components["schemas"][${JSON.stringify(name)}]`
}

function schemaType(schema, depth = 0) {
  if (!schema || typeof schema !== 'object') return 'unknown'
  if (depth > 30) return 'unknown'
  if (schema.$ref) return refType(schema.$ref)
  if (Object.hasOwn(schema, 'const')) return JSON.stringify(schema.const)
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  }

  const alternatives = schema.oneOf ?? schema.anyOf
  if (Array.isArray(alternatives) && alternatives.length) {
    return alternatives.map((item) => schemaType(item, depth + 1)).join(' | ')
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    // Preserve the schema's own object properties. OpenAPI commonly uses allOf
    // only for cross-field required constraints; reducing the whole schema to
    // the allOf branch would otherwise generate `unknown` and disconnect
    // runtime request builders from the canonical network contract.
    if (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined) {
      const base = { ...schema }
      delete base.allOf
      return schemaType(base, depth + 1)
    }
    return schema.allOf.map((item) => schemaType(item, depth + 1)).join(' & ')
  }

  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => schemaType({ ...schema, type }, depth + 1)).join(' | ')
  }

  if (schema.type === 'string') return 'string'
  if (schema.type === 'number' || schema.type === 'integer') return 'number'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'null') return 'null'
  if (schema.type === 'array' || schema.items || schema.prefixItems) {
    if (Array.isArray(schema.prefixItems)) {
      return `[${schema.prefixItems.map((item) => schemaType(item, depth + 1)).join(', ')}]`
    }
    return `Array<${schemaType(schema.items ?? {}, depth + 1)}>`
  }

  if (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : [])
    const fields = Object.entries(schema.properties ?? {}).map(([key, value]) => {
      const optional = required.has(key) ? '' : '?'
      return `${quoteKey(key)}${optional}: ${schemaType(value, depth + 1)}`
    })
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      fields.push(`[key: string]: ${schemaType(schema.additionalProperties, depth + 1)}`)
    } else if (schema.additionalProperties !== false) {
      // JSON Schema objects are open by default. Preserve that behavior in the
      // generated TypeScript instead of incorrectly narrowing them to never.
      fields.push('[key: string]: unknown')
    }
    return fields.length ? `{ ${fields.join('; ')} }` : 'Record<string, never>'
  }

  return 'unknown'
}

function contentType(content) {
  if (!content || typeof content !== 'object') return 'never'
  const entries = Object.entries(content)
  if (!entries.length) return 'never'
  return `{ ${entries.map(([mime, media]) => `${JSON.stringify(mime)}: ${schemaType(media?.schema ?? {})}`).join('; ')} }`
}

function resolveParameter(parameter, document) {
  if (!parameter || typeof parameter !== 'object') return null
  if (!parameter.$ref) return parameter
  const match = String(parameter.$ref).match(/^#\/components\/parameters\/([^/]+)$/)
  return match ? document.components?.parameters?.[match[1]] ?? null : null
}

function parametersType(parameters, document) {
  if (!Array.isArray(parameters) || !parameters.length) return 'never'
  const groups = new Map()
  for (const unresolved of parameters) {
    const parameter = resolveParameter(unresolved, document)
    if (!parameter || typeof parameter !== 'object') continue
    const location = parameter.in ?? 'query'
    const list = groups.get(location) ?? []
    list.push(parameter)
    groups.set(location, list)
  }
  if (!groups.size) return 'never'
  const rendered = [...groups.entries()].map(([location, list]) => {
    const body = list.map((parameter) => {
      const optional = parameter.required ? '' : '?'
      return `${quoteKey(parameter.name)}${optional}: ${schemaType(parameter.schema ?? {})}`
    }).join('; ')
    return `${quoteKey(location)}: { ${body} }`
  }).join('; ')
  return `{ ${rendered} }`
}

function operationType(operation, inheritedParameters = [], document) {
  const parameters = [...inheritedParameters, ...(operation.parameters ?? [])]
  const requestBody = operation.requestBody
  const requestBodyType = requestBody?.content
    ? `{ content: ${contentType(requestBody.content)} }`
    : 'never'
  const responses = Object.entries(operation.responses ?? {}).map(([status, response]) => {
    const type = response?.content ? `{ content: ${contentType(response.content)} }` : 'Record<string, never>'
    return `${quoteKey(status)}: ${type}`
  }).join('; ')
  return `{ parameters: ${parametersType(parameters, document)}; requestBody: ${requestBodyType}; responses: { ${responses} } }`
}

function pathsType(paths, document) {
  const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])
  return Object.entries(paths ?? {}).map(([path, item]) => {
    const inherited = Array.isArray(item.parameters) ? item.parameters : []
    const operations = [...methods].map((method) => {
      const operation = item[method]
      return `${method}${operation ? '' : '?'}: ${operation ? operationType(operation, inherited, document) : 'never'}`
    }).join('; ')
    return `  ${JSON.stringify(path)}: { ${operations} }`
  }).join('\n')
}

async function generate(inputPath, outputPath) {
  const input = resolve(root, inputPath)
  const output = resolve(root, outputPath)
  const source = await readFile(input, 'utf8')
  const document = JSON.parse(source)
  const sourceHash = createHash('sha256').update(`${JSON.stringify(document)}\n`).digest('hex')
  const schemas = Object.entries(document.components?.schemas ?? {}).map(([name, schema]) => {
    return `    ${JSON.stringify(name)}: ${schemaType(schema)}`
  }).join('\n')
  const version = document.info?.version ?? 'unknown'
  const text = `/**\n * Generated from ${inputPath}.\n * Contract version: ${version}.\n * Source SHA-256: ${sourceHash}.\n * Run \`npm run api:refresh\` after the public OpenAPI documents change.\n */\n\nexport interface paths {\n${pathsType(document.paths, document)}\n}\n\nexport interface components {\n  schemas: {\n${schemas}\n  }\n}\n\nexport type operations = Record<string, never>\n`
  await writeFile(output, text)
  console.log(`generated ${outputPath} (${version})`)
}

for (const [input, output] of targets) await generate(input, output)
