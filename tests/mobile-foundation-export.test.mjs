import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { exportMobileFoundation } from '../scripts/export-mobile-foundation.mjs';

test('standalone export runs outside repository and excludes customer/config files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-mobile-export-'));
  try {
    const destination = join(directory, 'standalone');
    await exportMobileFoundation(destination);
    assert.deepEqual((await readdir(destination)).sort(), ['README.md', 'package.json', 'src', 'test']);
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    const { stdout } = await promisify(execFile)(process.execPath, ['--test', '--test-reporter=tap', 'test/brand.test.mjs'], { cwd: destination, env: childEnv });
    assert.match(stdout, /fail 0/);
    await writeFile(join(destination, 'keep.txt'), 'preserve');
    await assert.rejects(exportMobileFoundation(destination), { code: 'EEXIST' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('export refuses an external path whose parent symlink points into the repo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-mobile-link-'));
  try {
    await symlink(new URL('../', import.meta.url).pathname, join(directory, 'source'), 'dir');
    await assert.rejects(exportMobileFoundation(join(directory, 'source', 'never-created')), /outside/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('export refuses the parent repo and destinations inside it', async () => {
  await assert.rejects(exportMobileFoundation(new URL('../', import.meta.url).pathname), /outside/);
  await assert.rejects(exportMobileFoundation(new URL('../apps/export-test', import.meta.url).pathname), /outside/);
});
