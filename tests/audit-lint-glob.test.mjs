import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const pluginRequire = createRequire(require.resolve('@next/eslint-plugin-next'))
const { getRootDirs } = pluginRequire('./utils/get-root-dirs.js')
const globPackage = pluginRequire('fast-glob/package.json')
assert.equal(globPackage.name, 'tinyglobby')
assert.equal(globPackage.version, '0.2.17')
const root = await mkdtemp(join(tmpdir(), 'gridex-lint-glob-'))
try {
  for (const name of ['web', 'support']) await mkdir(join(root, 'apps', name), { recursive: true })
  await writeFile(join(root, 'apps', 'not-a-directory'), '')
  // Next joins pages/app onto these roots. Both relative/absolute roots and
  // trailing directory separators resolve to the same filesystem directories.
  const dirs = rootDir => getRootDirs({ cwd: root, settings: { next: { rootDir } } }).map(dir => resolve(dir)).sort()
  const expected = ['support', 'web'].map(name => join(root, 'apps', name)).sort()
  assert.deepEqual(dirs(undefined), [root])
  assert.deepEqual(dirs(join(root, 'apps', '*')), expected)
  assert.deepEqual(dirs(join(root, 'apps', '{web,support}')), expected)
  assert.deepEqual(dirs(expected), expected)
  assert.deepEqual(dirs(join(root, 'apps', 'web')), [join(root, 'apps', 'web')])
  assert.deepEqual(dirs(join(root, 'missing', '*')), [])
  console.log('Next lint uses pinned tinyglobby; default, explicit, array and monorepo directory patterns preserve behavior')
} finally { await rm(root, { recursive: true, force: true }) }
