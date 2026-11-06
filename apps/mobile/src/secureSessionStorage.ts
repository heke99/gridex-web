type Store = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };
/** Chunk large Supabase sessions; never fall back to unencrypted storage. */
export function secureSessionStorage(store: Store, namespace: string) {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(namespace)) throw new Error('Invalid storage namespace');
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work); chain = next.catch(() => {}); return next;
  };
  const root = (key: string) => {
    if (!/^[A-Za-z0-9._-]{1,180}$/.test(key)) throw new Error('Invalid storage key');
    return `${namespace}.${key}`;
  };
  const manifest = async (base: string) => {
    const raw = await store.getItemAsync(base);
    if (!raw) return null;
    try {
      const m = JSON.parse(raw);
      if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id) || !Number.isInteger(m.count) || m.count < 1 || m.count > 256) throw new Error('Invalid session manifest');
      return m as { id: string; count: number };
    } catch { await store.deleteItemAsync(base); return null; }
  };
  const cleanup = async (base: string, m: { id: string; count: number } | null) => {
    if (m) for (let i = 0; i < m.count; i++) await store.deleteItemAsync(`${base}.${m.id}.${i}`);
  };
  return {
    getItem: (key: string) => serial(async () => {
      const base = root(key); const m = await manifest(base);
      if (!m) return null;
      let value = '';
      for (let i = 0; i < m.count; i++) {
        const part = await store.getItemAsync(`${base}.${m.id}.${i}`);
        if (part === null) { await store.deleteItemAsync(base); await cleanup(base, m); return null; }
        value += part;
      }
      return value;
    }),
    setItem: (key: string, value: string) => serial(async () => {
      if (!value || value.length > 76800) throw new Error('Session exceeds secure storage limit');
      const base = root(key); const old = await manifest(base);
      // IDs are storage generations, not credentials or cryptographic nonces.
      const chunks: string[] = []; let chunk = '';
      for (const character of value) {
        if (chunk.length + character.length > 300) { chunks.push(chunk); chunk = ''; }
        chunk += character;
      }
      if (chunk) chunks.push(chunk);
      if (chunks.length > 256) throw new Error('Session exceeds secure storage limit');
      const m = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: chunks.length };
      try {
        for (let i = 0; i < m.count; i++) await store.setItemAsync(`${base}.${m.id}.${i}`, chunks[i]);
        await store.setItemAsync(base, JSON.stringify(m));
      } catch (error) { await cleanup(base, m).catch(() => {}); throw error; }
      await cleanup(base, old).catch(() => {});
    }),
    removeItem: (key: string) => serial(async () => {
      const base = root(key); const m = await manifest(base);
      await store.deleteItemAsync(base); await cleanup(base, m);
    }),
  };
}
