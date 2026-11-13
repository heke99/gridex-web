/** Bound the caller's wait even when a provider does not honour cancellation. */
export function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const finish = (accept: () => void) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', cancel);
      accept();
    };
    const cancel = () => finish(() => reject(new Error('Cancelled')));
    operation.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
  });
}
