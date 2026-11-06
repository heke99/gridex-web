import { mkdir, copyFile, lstat, realpath, rm } from 'node:fs/promises';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = [
  'package.json', 'README.md', 'src/brand.mjs', 'src/brand.d.ts',
  'src/ports.d.ts', 'test/brand.test.mjs',
];

/** Only explicitly reviewed source files; never DB rows, .env, keys or web files. */
export async function exportMobileFoundation(destination) {
  if (!destination) throw new Error('A new destination directory is required');
  const target = resolve(destination);
  const canonicalTarget = join(await realpath(dirname(target)), target.slice(dirname(target).length + 1));
  const rel = relative(root, canonicalTarget);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) {
    throw new Error('Destination must be outside the source repository');
  }
  // Non-recursive mkdir deliberately refuses existing directories and symlinks.
  await mkdir(target);
  try {
    for (const file of allowed) {
      const source = join(root, 'packages/mobile-foundation', file);
      // Refuse symlinks in every source component, including directories.
      let component = root;
      for (const part of ['packages', 'mobile-foundation', ...file.split('/')]) {
        component = join(component, part);
        if ((await lstat(component)).isSymbolicLink()) throw new Error('Source symlinks are not exportable');
      }
      if (!(await lstat(source)).isFile()) throw new Error('Only regular source files are exportable');
      await mkdir(dirname(join(target, file)), { recursive: true });
      await copyFile(source, join(target, file));
    }
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
  return target;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await exportMobileFoundation(process.argv[2])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
