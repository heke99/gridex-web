import { resolve as priorResolve, load as priorLoad } from './staff-api-loader.mjs'
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') return { url: 'data:text/javascript,export async function cookies(){throw new Error("Unexpected Next cookie access in pure test")}', shortCircuit: true }
  if (specifier === 'next/navigation') return { url: 'data:text/javascript,export function redirect(path){throw new Error("REDIRECT "+path)}', shortCircuit: true }
  return priorResolve(specifier, context, nextResolve)
}
export { priorLoad as load }
