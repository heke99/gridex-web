import { headers } from 'next/headers'
import { isSupportHost } from '@/lib/routing/supportHost'

/** Native Web/customer Auth is unavailable on the isolated OPS staff host. */
export async function requireCustomerAuthHost(): Promise<void> {
  const incoming = await headers()
  // Next may forward a Server Action internally to its owning worker. A staff
  // origin remains forbidden even when that worker receives a loopback Host.
  if (isSupportHost(incoming.get('host') ?? '') || isSupportHost(incoming.get('x-forwarded-host') ?? '')) {
    throw new Error('Customer authentication is unavailable on the staff host')
  }
}
