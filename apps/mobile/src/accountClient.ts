import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage } from './secureSessionStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const customerApi = process.env.EXPO_PUBLIC_CUSTOMER_API_URL;
const validUrl = (value?: string) => { try { const u = new URL(value ?? ''); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/'; } catch { return false; } };
function publicKey(value?: string) {
  if (!value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const part = value.split('.')[1];
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}
const clients = new Map<string, SupabaseClient>();
export function createAccountClient(brand: string) {
  if (!validUrl(url) || !validUrl(customerApi) || !publicKey(key)) return null;
  const existing = clients.get(brand);
  if (existing) return existing;
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  const storage = secureSessionStorage({
    getItemAsync: name => SecureStore.getItemAsync(name, options),
    setItemAsync: (name, value) => SecureStore.setItemAsync(name, value, options),
    deleteItemAsync: name => SecureStore.deleteItemAsync(name, options),
  }, brand);
  const client = createClient(url!, key!, { auth: {
    storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
  } });
  clients.set(brand, client);
  return client;
}
