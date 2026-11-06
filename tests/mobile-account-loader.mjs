import { stat } from 'node:fs/promises';
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
export async function resolve(specifier, context, next) {
  if (context.parentURL?.includes('/accountClient.ts')) {
    if (specifier === 'react-native-url-polyfill/auto') return { url: moduleUrl('export {};'), shortCircuit: true };
    if (specifier === '@supabase/supabase-js') return { url: moduleUrl('export const createClient = (...args) => globalThis.__mobileAdapterFixture.createClient(...args);'), shortCircuit: true };
    if (specifier === 'expo-secure-store') return { url: moduleUrl('export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 1; export const getItemAsync = (...a) => globalThis.__mobileAdapterFixture.get(...a); export const setItemAsync = (...a) => globalThis.__mobileAdapterFixture.set(...a); export const deleteItemAsync = (...a) => globalThis.__mobileAdapterFixture.remove(...a);'), shortCircuit: true };
  }
  if (context.parentURL?.endsWith('/useCustomerAccount.ts')) {
    if (specifier === 'react-native') return { url: moduleUrl('export const AppState = globalThis.__mobileFixture.appState;'), shortCircuit: true };
    if (specifier === './accountClient') return { url: moduleUrl("export const customerApi = 'https://tenant.test'; export function createAccountClient() { return globalThis.__mobileFixture.client; }"), shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    try { await stat(url); return { url: url.href, shortCircuit: true }; } catch { /* use standard resolver */ }
  }
  return next(specifier, context);
}
