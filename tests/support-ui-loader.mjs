import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import { resolve as priorResolve, load as priorLoad } from './staff-api-loader.mjs'
import ts from 'typescript'

// Replace framework request-local boundaries only. Auth, session, actions and
// the signed API client remain the application's actual modules.
const root = fileURLToPath(new URL('../', import.meta.url))
export async function load(url, context, nextLoad) {
  if (url.startsWith(pathToFileURL(resolvePath(root, 'apps/support')).href + '/') && url.endsWith('.tsx')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    const compiled = ts.transpileModule(source, { fileName: fileURLToPath(url), compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    } })
    return { format: 'module', source: compiled.outputText, shortCircuit: true }
  }
  return priorLoad(url, context, nextLoad)
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/link') return nextResolve('next/link.js', context)
  const boundaries = {
    'next/headers': 'export async function cookies(){if(!globalThis.__supportTestCookies)throw new Error("Missing test cookie boundary");return globalThis.__supportTestCookies}',
    'next/navigation': 'export function redirect(path){const e=new Error("REDIRECT "+path);e.location=path;throw e}',
    'next/cache': 'export function revalidatePath(path){if(!globalThis.__supportTestRevalidations)throw new Error("Missing test cache boundary");globalThis.__supportTestRevalidations.push(path)}',
  }
  if (boundaries[specifier]) return { url: `data:text/javascript,${encodeURIComponent(boundaries[specifier])}`, shortCircuit: true }
  const prefix = specifier.startsWith('@/support/') ? ['@/support/', 'apps/support/'] : specifier.startsWith('@/staff-api/') ? ['@/staff-api/', 'lib/staff-api/'] : null
  if (prefix) {
    const candidate = resolvePath(root, prefix[1] + specifier.slice(prefix[0].length))
    const path = ['.ts', '.tsx', '.mjs', ''].map(ext => candidate + ext).find(existsSync)
    if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
  }
  return priorResolve(specifier, context, nextResolve)
}
