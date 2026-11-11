import { abortable } from './abortable';

/** Own every Auth transport through its body, so cancellation precedes SDK storage. */
export function createAccountFetch() {
 const pending = new Set<AbortController>();
 const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  pending.add(controller);
  const cancel = () => controller.abort();
  const upstream = init?.signal;
  if (upstream?.aborted) controller.abort();
  else upstream?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 10000);
  try {
    if (controller.signal.aborted) throw new Error('Cancelled');
    const response = await abortable(fetch(input, { ...init, signal: controller.signal }), controller.signal);
    // Native fetch's ArrayBuffer-backed Response decodes JSON as Latin-1.
    // Auth is UTF-8 text: preserve it through the platform's text decoder.
    const body = await abortable(response.text(), controller.signal);
    return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally {
    clearTimeout(timeout);
    upstream?.removeEventListener('abort', cancel);
    pending.delete(controller);
  }
 };
 return { fetch: boundedFetch, cancelPending: () => { for (const controller of pending) controller.abort(); } };
}

export const accountFetch = createAccountFetch().fetch;
