import { OpsError } from '../ops/errors';
export type MobileContract = { reference: string; name: string | null; status: string | null; startDate: string | null };
type Dependencies = {
  enabled: () => boolean;
  authenticate: (token: string) => Promise<string | null>;
  contracts: (subject: string, token: string, cursor?: string) => Promise<unknown[] | { items: unknown[]; page: { hasMore: boolean | null; nextCursor: string | null } }>;
};
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (status: number, body: unknown) => Response.json(body, { status, headers });

/** No customer identifiers are accepted from the device, including query strings. */
export function createContractsHandler(deps: Dependencies, resource: 'contracts' | 'sites' | 'invoices' | 'invoiceDetail' | 'invoiceDocument' | 'support' | 'supportDetail' | 'profile' | 'notifications' | 'documents' | 'powers' | 'acceptances' | 'customerDocument' = 'contracts', allowCursor = false) {
  return async (request: Request): Promise<Response> => {
    if (!deps.enabled()) return reply(404, { error: 'Mobilanslutningen är inte aktiverad.' });
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(k => !allowCursor || k !== 'cursor') || query.getAll('cursor').length > 1 || (query.has('cursor') && (!query.get('cursor') || query.get('cursor')!.length > 2048))) return reply(400, { error: 'Otillåtna parametrar.' });
    const value = request.headers.get('authorization') ?? '';
    const match = /^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(value);
    if (!match) return reply(401, { error: 'Logga in för att fortsätta.' });
    try {
      const subject = await deps.authenticate(match[1]);
      if (!subject) return reply(401, { error: 'Din inloggning behöver förnyas.' });
      const contracts = await deps.contracts(subject, match[1], query.get('cursor') ?? undefined);
      return reply(200, { data: { [resource]: Array.isArray(contracts) ? contracts : contracts.items }, ...(!Array.isArray(contracts) ? { page: contracts.page } : {}) });
    } catch (error) {
      if (resource === 'invoiceDetail' && error instanceof OpsError && [403, 404].includes(error.status)) {
        return reply(404, { error: 'Fakturan hittades inte.' });
      }
      // Never reflect SDK/OPS errors or credentials to the device/logs.
      return reply(503, { error: 'Kunduppgifterna kan inte hämtas just nu.' });
    }
  };
}
