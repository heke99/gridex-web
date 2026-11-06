export type MobileContract = { reference: string; name: string | null; status: string | null; startDate: string | null };
type Dependencies = {
  enabled: () => boolean;
  authenticate: (token: string) => Promise<string | null>;
  contracts: (subject: string, token: string) => Promise<unknown[]>;
};
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (status: number, body: unknown) => Response.json(body, { status, headers });

/** No customer identifiers are accepted from the device, including query strings. */
export function createContractsHandler(deps: Dependencies, resource: 'contracts' | 'sites' | 'invoices' = 'contracts') {
  return async (request: Request): Promise<Response> => {
    if (!deps.enabled()) return reply(404, { error: 'Mobilanslutningen är inte aktiverad.' });
    if (new URL(request.url).search) return reply(400, { error: 'Otillåtna parametrar.' });
    const value = request.headers.get('authorization') ?? '';
    const match = /^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(value);
    if (!match) return reply(401, { error: 'Logga in för att fortsätta.' });
    try {
      const subject = await deps.authenticate(match[1]);
      if (!subject) return reply(401, { error: 'Din inloggning behöver förnyas.' });
      const contracts = await deps.contracts(subject, match[1]);
      return reply(200, { data: { [resource]: contracts } });
    } catch {
      // Never reflect SDK/OPS errors or credentials to the device/logs.
      return reply(503, { error: 'Kunduppgifterna kan inte hämtas just nu.' });
    }
  };
}
