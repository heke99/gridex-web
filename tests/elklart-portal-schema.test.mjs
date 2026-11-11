import assert from 'node:assert/strict'
import { comparePortalSchemas } from '../scripts/elklart-demo/verify-portal-schema.mjs'
import { test } from 'node:test'
import { chmod, lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { compileSchema, validateLocalTarget, validatePortalContainer, writeSchemaArtifacts, localDockerArguments } from '../scripts/elklart-demo/portal-schema.mjs'

function metadata() {
  return { format_version: 1, source_project: 'ayiuxjlfazkjmmtlvhsl', captured_at: '2026-11-10T00:00:00Z', unsupported: [], schema_acl: [], owners: [], type_revoke: [], type_acl: [], extensions: [], enums: [], sequences: [], tables: [{ name: 'user_profiles', ddl: 'CREATE TABLE user_profiles(id uuid);', rls: 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;' }, { name: 'customer_profiles', ddl: 'CREATE TABLE customer_profiles(id uuid);', rls: 'ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;' }], defaults: [], functions: [], constraints: [], indexes: [], views: [], triggers: [], policies: [], relation_acl: [], column_acl: [], default_acl: [] }
}
test('restore target rejects remote and other local databases/projects', () => {
  assert.equal(validateLocalTarget('postgresql://postgres:private@localhost:55322/postgres').port, '55322')
  for (const value of ['postgresql://postgres:private@db.example.com:55322/postgres', 'postgresql://postgres@localhost:5432/postgres', 'postgresql://postgres@localhost:55322/ops', 'postgresql://postgres@localhost:55322/postgres?host=remote.example.com', 'https://localhost:55322/postgres']) assert.throws(() => validateLocalTarget(value))
})
test('view dependency order is deterministic and fails closed on cycles', () => {
  const snapshot = metadata()
  snapshot.views = [{ name: 'summary', ddl: 'CREATE VIEW summary AS SELECT * FROM detail;', depends: ['detail'] }, { name: 'detail', ddl: 'CREATE VIEW detail AS SELECT 1;', depends: [] }]
  const sql = compileSchema(snapshot)
  assert.ok(sql.indexOf('CREATE VIEW detail') < sql.indexOf('CREATE VIEW summary'))
  snapshot.views[1].depends = ['summary']
  assert.throws(() => compileSchema(snapshot), /Cyclic/)
})
test('missing baseline, provenance and unsupported objects abort compilation', () => {
  const missing = metadata(); missing.tables = []
  assert.throws(() => compileSchema(missing), /baseline/)
  const source = metadata(); source.source_project = 'other'
  assert.throws(() => compileSchema(source), /unproven/)
  const unsupported = metadata(); unsupported.unsupported = ['partitioned_table']
  assert.throws(() => compileSchema(unsupported), /Unsupported/)
  const partial = metadata(); delete partial.policies
  assert.throws(() => compileSchema(partial), /policies/)
})


test('Docker adapter verifies project label and every port binding', () => {
  const configuration = { Config: { Labels: { 'com.supabase.cli.project': 'elklart-portal-demo' } }, HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55322' }] } }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55322' }] } } }
  validatePortalContainer(configuration)
  configuration.NetworkSettings.Ports['5432/tcp'].push({ HostIp: '0.0.0.0', HostPort: '55322' })
  assert.throws(() => validatePortalContainer(configuration), /loopback/)
  configuration.NetworkSettings.Ports['5432/tcp'].pop()
  configuration.Config.Labels['com.supabase.cli.project'] = 'other-project'
  assert.throws(() => validatePortalContainer(configuration), /Container/)
})


test('schema artifacts are exclusively created with private permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'elklart-schema-private-'))
  try {
    const output = join(directory, 'schema.sql')
    await writeSchemaArtifacts(output, 'private schema', { source: 'synthetic' })
    for (const path of [output, `${output}.provenance.json`]) {
      assert.equal((await lstat(path)).mode & 0o777, 0o600)
    }
    assert.equal(await readFile(output, 'utf8'), 'private schema')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('existing readable files and symlinks are refused for either artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'elklart-schema-existing-'))
  try {
    for (const artifact of ['sql', 'provenance']) {
      for (const kind of ['file', 'symlink']) {
        const output = join(directory, `${artifact}-${kind}.sql`)
        const blocked = artifact === 'sql' ? output : `${output}.provenance.json`
        const original = join(directory, `${artifact}-${kind}-target`)
        await writeFile(original, 'unchanged', { mode: 0o644 })
        await chmod(original, 0o644)
        if (kind === 'symlink') await symlink(original, blocked)
        else { await writeFile(blocked, 'unchanged'); await chmod(blocked, 0o644) }
        await assert.rejects(writeSchemaArtifacts(output, 'private schema', { source: 'synthetic' }), { code: 'EEXIST' })
        assert.equal(await readFile(blocked, 'utf8'), 'unchanged')
        assert.equal(await readFile(original, 'utf8'), 'unchanged')
        assert.equal((await lstat(original)).mode & 0o777, 0o644)
        if (artifact === 'provenance') await assert.rejects(lstat(output), { code: 'ENOENT' })
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})


test('scalar functions precede generated columns and composite signatures follow tables', () => {
  const snapshot = metadata()
  snapshot.functions = [
    { name: 'normalize(text)', requires_relation_type: false, ddl: 'CREATE FUNCTION normalize(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$', acl: [] },
    { name: 'customer_record()', requires_relation_type: true, ddl: 'CREATE FUNCTION customer_record() RETURNS customer_profiles LANGUAGE sql AS $$ SELECT * FROM customer_profiles $$', acl: [] }
  ]
  const sql = compileSchema(snapshot)
  assert.ok(sql.indexOf('CREATE FUNCTION normalize') < sql.indexOf('CREATE TABLE customer_profiles'))
  assert.ok(sql.indexOf('CREATE TABLE customer_profiles') < sql.indexOf('CREATE FUNCTION customer_record'))
  delete snapshot.functions[0].requires_relation_type
  assert.throws(() => compileSchema(snapshot), /signature dependency/)
})


test('empty declared binding requires actual loopback and verified network default', () => {
  const configuration = { Config: { Labels: { 'com.supabase.cli.project': 'elklart-portal-demo' } }, HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '55322' }] } }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55322' }] }, Networks: { isolated: { NetworkID: 'network-id' } } } }
  const networks = [{ Id: 'network-id', Options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' } }]
  validatePortalContainer(configuration, networks)
  assert.throws(() => validatePortalContainer(configuration), /verified attached networks/)
  configuration.HostConfig.PortBindings['5432/tcp'][0].HostIp = '0.0.0.0'
  assert.throws(() => validatePortalContainer(configuration, networks), /Declared/)
  configuration.HostConfig.PortBindings['5432/tcp'][0].HostIp = ''
  configuration.NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0'
  assert.throws(() => validatePortalContainer(configuration, networks), /loopback/)
  configuration.NetworkSettings.Ports['5432/tcp'][0].HostIp = '127.0.0.1'
  networks[0].Options['com.docker.network.bridge.host_binding_ipv4'] = '0.0.0.0'
  assert.throws(() => validatePortalContainer(configuration, networks), /verified attached networks/)
})


test('restored schema audit accepts platform extension and rejects owner/ACL drift', () => {
  const source = metadata()
  source.owners = ['ALTER TABLE customer_profiles OWNER TO postgres;']
  source.functions = [{ name: 'f()', ddl: 'synthetic', requires_relation_type: false, acl: ['GRANT EXECUTE TO postgres;', 'GRANT EXECUTE TO service_role;'] }]
  const restored = structuredClone(source)
  restored.extensions.push('CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;')
  restored.functions[0].acl.reverse()
  assert.equal(comparePortalSchemas(source, restored).matches, true)
  restored.owners[0] = 'ALTER TABLE customer_profiles OWNER TO supabase_admin;'
  assert.deepEqual(comparePortalSchemas(source, restored).differences, ['owners'])
  restored.owners = [...source.owners]
  restored.functions[0].acl.push('GRANT EXECUTE TO PUBLIC;')
  assert.deepEqual(comparePortalSchemas(source, restored).differences, ['functions'])
})


test('every Docker operation pins the local socket and rejects endpoint/context overrides', () => {
  for (const args of [['inspect', 'container'], ['network', 'inspect', 'network'], ['exec', '-i', 'container', 'psql']]) {
    assert.deepEqual(localDockerArguments(args, {}), ['--host', 'unix:///var/run/docker.sock', ...args])
  }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_CONFIG']) {
    for (const value of ['untrusted-override', '']) assert.throws(() => localDockerArguments(['inspect','container'], { [key]: value }), /overrides are refused/)
  }
})

test('CLI apply rejects Docker overrides before invoking any Docker executable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'elklart-docker-guard-'))
  try {
    const input = join(directory,'metadata.json')
    const marker = join(directory,'docker-was-invoked')
    const executable = join(directory,'docker')
    const bytes = JSON.stringify(metadata())
    await writeFile(input,bytes)
    await writeFile(executable, '#!/bin/sh\nprintf called > "$ELKLART_DOCKER_TEST_MARKER"\nexit 98\n', { mode: 0o700 })
    await chmod(executable,0o700)
    const base = { ...process.env, PATH: `${directory}:${process.env.PATH}`, ELKLART_PORTAL_DB_CONTAINER: 'supabase_db_elklart-portal-demo', ELKLART_DEMO_RESET_ACK: 'elklart-portal-local-only', ELKLART_PORTAL_SCHEMA_SHA256: createHash('sha256').update(bytes).digest('hex'), ELKLART_DOCKER_TEST_MARKER: marker }
    for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','DOCKER_CONFIG']) delete base[key]
    for (const [key,value] of Object.entries({ DOCKER_HOST: 'tcp://unreachable.example.invalid:2375', DOCKER_CONTEXT: 'remote-production', DOCKER_CONFIG: directory })) {
      const result = spawnSync(process.execPath, [new URL('../scripts/elklart-demo/portal-schema.mjs',import.meta.url).pathname,'apply',input], { env: { ...base, [key]: value }, encoding: 'utf8' })
      assert.equal(result.status,1)
      assert.match(result.stderr,/overrides are refused/)
      await assert.rejects(lstat(marker), { code: 'ENOENT' })
    }
  } finally { await rm(directory,{ recursive:true,force:true }) }
})
