import { resolve as aliasResolve, load as aliasLoad } from './typescript-alias-loader.mjs'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/customerPortal/service') {
    const source = `
      export class CustomerPortalAccessError extends Error {
        status = 401; code = 'unauthorized';
        constructor() { super('Logga in för att hämta fullmakten.'); }
      }
      export async function getPortalSession() {
        if (!globalThis.__poaArchiveTestUser) throw new CustomerPortalAccessError();
        return { user: { id: globalThis.__poaArchiveTestUser } };
      }
    `
    return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
  }
  return aliasResolve(specifier, context, nextResolve)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const source = await readFile(new URL(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText }
  }
  return aliasLoad(url, context, nextLoad)
}
