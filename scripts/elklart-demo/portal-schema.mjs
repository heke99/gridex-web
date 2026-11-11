import { open, readFile, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LOCAL_DOCKER_SOCKET = 'unix:///var/run/docker.sock'
export function localDockerArguments(args, env = process.env) {
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_CONFIG']) {
    if (env[key] !== undefined) throw new Error('Docker endpoint/context/TLS/config overrides are refused for local portal restore.')
  }
  return ['--host', LOCAL_DOCKER_SOCKET, ...args]
}

const SOURCE = 'ayiuxjlfazkjmmtlvhsl'
export function validateLocalTarget(value) {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/postgres' || url.port !== '55322' || url.search || url.hash) {
    throw new Error('Requires loopback port 55322 and the dedicated portal stack postgres database.')
  }
  return url
}
export function validatePortalContainer(configuration, networks = []) {
  const bindings = configuration?.NetworkSettings?.Ports?.['5432/tcp']
  if (configuration?.Config?.Labels?.['com.supabase.cli.project'] !== 'elklart-portal-demo'
    || !Array.isArray(bindings) || !bindings.length
    || !bindings.every(binding => binding.HostPort === '55322' && ['127.0.0.1', '::1'].includes(binding.HostIp))) {
    throw new Error('Container must belong to elklart-portal-demo with only loopback port 55322 mapped to PostgreSQL.')
  }
  const declared = configuration?.HostConfig?.PortBindings?.['5432/tcp']
  if (!Array.isArray(declared) || !declared.length
    || !declared.every(binding => binding.HostPort === '55322' && ['', '127.0.0.1', '::1'].includes(binding.HostIp))) {
    throw new Error('Declared PostgreSQL bindings are missing or inconsistent with the dedicated loopback runtime.')
  }
  if (declared.some(binding => binding.HostIp === '')) {
    const attached = Object.values(configuration?.NetworkSettings?.Networks ?? {})
    if (!attached.length || !attached.every(network => networks.some(inspected => inspected.Id === network.NetworkID
      && inspected.Options?.['com.docker.network.bridge.host_binding_ipv4'] === '127.0.0.1'))) {
      throw new Error('Empty declared host binding requires verified attached networks with loopback binding defaults.')
    }
  }
}
export function compileSchema(snapshot) {
  if (snapshot.format_version !== 1 || snapshot.source_project !== SOURCE || !snapshot.captured_at) {
    throw new Error('Unsupported or unproven portal schema metadata.')
  }
  if (snapshot.unsupported?.length) throw new Error('Unsupported relation kinds in source schema.')
  for (const key of ['schema_acl', 'owners', 'type_revoke', 'type_acl', 'extensions', 'enums', 'sequences', 'tables', 'defaults', 'functions', 'constraints', 'indexes', 'views', 'triggers', 'policies', 'relation_acl', 'column_acl', 'default_acl']) {
    if (!Array.isArray(snapshot[key])) throw new Error(`Missing schema section: ${key}`)
  }
  if (!snapshot.tables.some(t => t.name === 'user_profiles') || !snapshot.tables.some(t => t.name === 'customer_profiles')) {
    throw new Error('Portal baseline tables missing.')
  }
  const sql = ['BEGIN;', 'SET LOCAL check_function_bodies = off;', 'CREATE SCHEMA IF NOT EXISTS extensions;']
  sql.push(...snapshot.extensions, ...snapshot.enums, ...snapshot.sequences)
  if (snapshot.functions.some(f => typeof f.requires_relation_type !== 'boolean')) throw new Error('Function signature dependency metadata missing.')
  sql.push(...snapshot.functions.filter(f => !f.requires_relation_type).map(f => `${f.ddl};`))
  sql.push(...snapshot.tables.map(t => t.ddl))
  sql.push(...snapshot.functions.filter(f => f.requires_relation_type).map(f => `${f.ddl};`))
  sql.push(...snapshot.defaults, ...snapshot.constraints, ...snapshot.indexes)
  const views = new Map(snapshot.views.map(v => [v.name, v]))
  while (views.size) {
    const ready = [...views.values()].filter(v => v.depends.every(d => !views.has(d)))
    if (!ready.length) throw new Error('Cyclic view dependencies in schema snapshot.')
    for (const view of ready) { sql.push(`${view.ddl};`); views.delete(view.name) }
  }
  sql.push(...snapshot.triggers, ...snapshot.tables.map(t => t.rls), ...snapshot.policies)
  sql.push('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;',
    'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;')
  sql.push(...snapshot.functions.map(f => `REVOKE ALL ON FUNCTION ${f.name} FROM PUBLIC, anon, authenticated, service_role;`))
  sql.push(...snapshot.type_revoke)
  sql.push('REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;', ...snapshot.schema_acl, ...snapshot.owners, ...snapshot.type_acl)
  sql.push(...snapshot.functions.flatMap(f => f.acl ?? []), ...snapshot.relation_acl, ...snapshot.column_acl, ...snapshot.default_acl)
  sql.push("NOTIFY pgrst, 'reload schema';", 'COMMIT;')
  return `${sql.join('\n')}\n`
}
export async function writeSchemaArtifacts(output, sql, provenance) {
  const sqlHandle = await open(output, 'wx', 0o600)
  let provenanceHandle
  try {
    provenanceHandle = await open(`${output}.provenance.json`, 'wx', 0o600)
  } catch (error) {
    await sqlHandle.close()
    await unlink(output)
    throw error
  }
  try {
    await sqlHandle.writeFile(sql)
    await provenanceHandle.writeFile(`${JSON.stringify(provenance, null, 2)}\n`)
  } finally {
    await Promise.all([sqlHandle.close(), provenanceHandle.close()])
  }
}
async function main() {
  const [mode, input, output] = process.argv.slice(2)
  if (!['compile', 'apply'].includes(mode) || !input) throw new Error('Usage: node scripts/elklart-demo/portal-schema.mjs compile metadata.json output.sql | apply metadata.json')
  const bytes = await readFile(input)
  const digest = createHash('sha256').update(bytes).digest('hex')
  const snapshot = JSON.parse(bytes)
  const sql = compileSchema(snapshot)
  if (mode === 'compile') {
    if (!output) throw new Error('Output SQL path is required.')
    await writeSchemaArtifacts(output, sql, { source_project: SOURCE, captured_at: snapshot.captured_at, metadata_sha256: digest, sql_sha256: createHash('sha256').update(sql).digest('hex'), scope: 'schema only; no application or Auth rows' })
    console.log('Compiled portal schema and provenance; output files are private.')
    return
  }
  if (process.env.ELKLART_DEMO_RESET_ACK !== 'elklart-portal-local-only') throw new Error('Missing dedicated local runtime acknowledgement.')
  const expected = process.env.ELKLART_PORTAL_SCHEMA_SHA256
  if (!expected || expected !== digest) throw new Error('Provide the reviewed metadata SHA256 in ELKLART_PORTAL_SCHEMA_SHA256.')
  const container = process.env.ELKLART_PORTAL_DB_CONTAINER
  let execute
  if (container) {
    if (container !== 'supabase_db_elklart-portal-demo') throw new Error('Unexpected portal container name.')
    const inspected = spawnSync('docker', localDockerArguments(['inspect', container]), { encoding: 'utf8' })
    if (inspected.error || inspected.status !== 0) throw new Error('Cannot verify dedicated portal container.')
    const [configuration] = JSON.parse(inspected.stdout)
    let networks = []
    if (configuration?.HostConfig?.PortBindings?.['5432/tcp']?.some(binding => binding.HostIp === '')) {
      const networkIds = Object.values(configuration?.NetworkSettings?.Networks ?? {}).map(network => network.NetworkID)
      if (!networkIds.length || !networkIds.every(id => /^[a-f0-9]{64}$/.test(id))) throw new Error('Cannot verify portal network identifiers.')
      const inspectedNetworks = spawnSync('docker', localDockerArguments(['network', 'inspect', ...networkIds]), { encoding: 'utf8' })
      if (inspectedNetworks.error || inspectedNetworks.status !== 0) throw new Error('Cannot verify portal network binding defaults.')
      networks = JSON.parse(inspectedNetworks.stdout)
    }
    validatePortalContainer(configuration, networks)
    execute = input => spawnSync('docker', localDockerArguments(['exec', '-i', container, 'psql', '--no-psqlrc', '-U', 'supabase_admin', '-d', 'postgres', '--set', 'ON_ERROR_STOP=1', '--quiet']), { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  } else {
    const target = validateLocalTarget(process.env.ELKLART_PORTAL_DATABASE_URL ?? '')
    const args = ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--quiet']
    const env = { ...process.env, PGHOST: target.hostname.replace(/^\[|\]$/g, ''), PGPORT: '55322', PGDATABASE: 'postgres', PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password) }
    execute = input => spawnSync('psql', args, { env, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  }
  const preflight = "DO $$ BEGIN IF current_setting('elklart.runtime_project', true) IS DISTINCT FROM 'elklart-portal-demo' THEN RAISE EXCEPTION 'Missing dedicated portal project marker'; END IF; IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','S')) THEN RAISE EXCEPTION 'Portal database is not empty; reset the dedicated stack first'; END IF; END $$;\n"
  // Credentials only enter the child environment, never argv or emitted logs.
  const result = execute(preflight + sql)
  if (result.error || result.status !== 0) throw new Error('Portal schema restore failed; inspect private PostgreSQL logs for dependencies. No success is claimed.')
  const verify = await readFile(new URL('../verify-gridex-web-database.sql', import.meta.url), 'utf8')
  const checked = execute(verify)
  if (checked.error || checked.status !== 0) throw new Error('Portal readiness verification failed; inspect private PostgreSQL logs.')
  console.log('Portal schema restored and existing database readiness query passed. Auth users and scenario flows still require verification.')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
