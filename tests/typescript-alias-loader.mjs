import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

function existingModulePath(candidate) {
  const candidates = extname(candidate)
    ? [candidate]
    : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.mjs`, resolvePath(candidate, 'index.ts'), resolvePath(candidate, 'index.tsx')]
  return candidates.find((value) => existsSync(value) && statSync(value).isFile()) ?? null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = existingModulePath(resolvePath(projectRoot, specifier.slice(2)))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parentPath = dirname(fileURLToPath(context.parentURL))
    const resolved = existingModulePath(resolvePath(parentPath, specifier))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.json')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    return {
      format: 'module',
      source: `export default ${source.trim()};`,
      shortCircuit: true,
    }
  }
  return nextLoad(url, context)
}
