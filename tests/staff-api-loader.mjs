import { resolve as existingResolve, load } from './typescript-alias-loader.mjs'
export { load }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return nextResolve('next/dist/compiled/server-only/empty.js', context)
  return existingResolve(specifier, context, nextResolve)
}
