import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import { resolve as resolveAlias, load } from './typescript-alias-loader.mjs'

export { load }

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/lib/webhooks/publicationChanged.ts')) {
    const stubs = {
      'next/cache': 'export const revalidateTag = (...args) => globalThis.__publicationWebhook.revalidateTag(...args); export const revalidatePath = (...args) => globalThis.__publicationWebhook.revalidatePath(...args)',
      '@supabase/supabase-js': 'export const createClient = () => ({ rpc: (...args) => globalThis.__publicationWebhook.rpc(...args) })',
      '@/lib/ops/client': 'export const getVerifiedOpsIntegrationContext = async () => ({ organization_reference: globalThis.__publicationWebhook.organization }); export const invalidateOpsPublicContractsCache = (...args) => globalThis.__publicationWebhook.invalidate(...args)',
    }
    const source = stubs[specifier]
    if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
  }
  // Only replace external snapshot/provider ports. Next's cache, async stores,
  // patched fetch and the application's transport all execute unchanged.
  if (specifier === '@/lib/ops/client') {
    const transport = pathToFileURL(resolvePath('lib/ops/transport.ts')).href
    const errors = pathToFileURL(resolvePath('lib/ops/errors.ts')).href
    const source = `
      import { opsRequest } from ${JSON.stringify(transport)};
      import { isOpsError } from ${JSON.stringify(errors)};
      export { isOpsError };
      export { OpsError } from ${JSON.stringify(errors)};
      export function isTransientOpsError(error) {
        return isOpsError(error) && error.retryable;
      }
      export const WEBSITE_OPENAPI_SCHEMA_SHA256 = 'a'.repeat(64);
      export function publicContractsCacheKey(type) {
        return globalThis.__contractRefreshFixture.identity + ':' + (type ?? 'all');
      }
      export async function fetchOpsPublicContractsSnapshot(type, options) {
        globalThis.__contractRefreshFixture.providerOptions.push({type, options});
        await opsRequest('/api/v1/website/public-contracts', {}, {cache: 'no-store'});
        return structuredClone(globalThis.__contractRefreshFixture.providerSnapshot ?? globalThis.__contractRefreshFixture.snapshot);
      }
      export function fetchOpsPublicContractDiagnostics() { throw new Error('Unexpected diagnostics'); }
    `
    return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
  }
  if (specifier === '@/lib/website/publicContractSnapshotStore') {
    return { url: `data:text/javascript,${encodeURIComponent(`
      export const maxWebsitePublicContractSnapshotAgeMs = () => 900_000;
      export async function readWebsitePublicContractSnapshot() {
        globalThis.__contractRefreshFixture.snapshotReads += 1;
        return structuredClone(globalThis.__contractRefreshFixture.snapshot);
      }
      export async function storeWebsitePublicContractSnapshot(input) {
        globalThis.__contractRefreshFixture.persisted.push(structuredClone(input));
        return globalThis.__contractRefreshFixture.storeResult;
      }
    `)}`, shortCircuit: true }
  }
  return resolveAlias(specifier, context, nextResolve)
}
