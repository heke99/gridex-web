type Input = { title?: string; message: string };
type Dependencies = { enabled: () => boolean; authenticate: (token: string) => Promise<string | null>; submit: (subject: string, token: string, input: Input, key: string) => Promise<unknown> };
const headers = { 'Cache-Control': 'private, no-store' };
const reply = (status: number, error: string) => Response.json({ error }, { status, headers });
export function supportWriteHandler(deps: Dependencies, create = false) {
  return async (request: Request) => {
    if (!deps.enabled()) return reply(404, 'Mobilanslutningen är inte aktiverad.');
    if (request.method !== 'POST' || new URL(request.url).search) return reply(400, 'Ogiltig begäran.');
    const token = /^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, 'Logga in igen.');
    const key = request.headers.get('idempotency-key') ?? '';
    if (!/^[A-Za-z0-9._:+~-]{8,200}$/.test(key)) return reply(400, 'Begäran saknar giltig försöksreferens.');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply(415, 'JSON krävs.');
    try {
      const subject = await deps.authenticate(token); if (!subject) return reply(401, 'Logga in igen.');
      const reader = request.body?.getReader(); const decoder = new TextDecoder(); let raw = ''; let size = 0;
      if (reader) while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength; if (size > 40000) { await reader.cancel(); return reply(413, 'Meddelandet är för stort.'); }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
      let input: Input;
      try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !(create ? ['title','message'] : ['message']).includes(k))
          || typeof value.message !== 'string' || !value.message.trim() || value.message.length > 8000
          || (create && (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 180))) return reply(400, 'Kontrollera rubrik och meddelande.');
        input = create ? { title: value.title, message: value.message } : { message: value.message };
      } catch { return reply(400, 'Ogiltig JSON.'); }
      const data = await deps.submit(subject, token, input, key);
      return Response.json({ data }, { status: 201, headers });
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 503;
      return reply([403,404,409,429].includes(status) ? status : 503, 'Begäran kunde inte slutföras. Försök igen med samma innehåll innan du ändrar det.');
    }
  };
}
