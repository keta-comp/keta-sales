/** Fire-and-forget + latency instrumentation helpers for the Telegram pipeline. */

type WaitUntil = (p: Promise<unknown>) => void;

function findWaitUntil(): WaitUntil | null {
  const g = globalThis as unknown as Record<string, any>;
  const candidates = [
    g["__lovableExecutionCtx"],
    g["executionCtx"],
    g["ctx"],
    g[Symbol.for("__cloudflare-request-context__") as unknown as string],
    g["__cloudflare_request_context__"],
  ];
  for (const c of candidates) {
    if (c && typeof c.waitUntil === "function") return c.waitUntil.bind(c);
    if (c && c.ctx && typeof c.ctx.waitUntil === "function") return c.ctx.waitUntil.bind(c.ctx);
  }
  return null;
}

/** True when the runtime can keep work alive after the response is sent. */
export function hasWaitUntil(): boolean {
  return findWaitUntil() !== null;
}

const pending = new Set<Promise<void>>();

/** Awaits any still-running background work (used when waitUntil is unavailable). */
export async function drainBackground(): Promise<void> {
  while (pending.size) {
    const current = [...pending];
    await Promise.allSettled(current);
    current.forEach((p) => pending.delete(p));
  }
}

/**
 * Runs work after the HTTP response is returned.
 * Uses the platform waitUntil when available. Returns the promise so callers that
 * MUST NOT lose the work (e.g. the Telegram webhook) can await it as a last resort —
 * a detached promise is killed by the Worker runtime once the response is returned.
 */
export function runBackground(work: () => Promise<unknown>, label: string): Promise<void> {
  const promise = (async () => {
    try {
      await work();
    } catch (error) {
      console.error(`[background:${label}]`, error);
    }
  })();
  const waitUntil = findWaitUntil();
  if (waitUntil) waitUntil(promise);
  else {
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  }
  return promise;
}

export type Timings = Record<string, number>;

export function createTimer() {
  const start = Date.now();
  let last = start;
  const marks: Timings = {};
  return {
    mark(name: string) {
      const now = Date.now();
      marks[name] = now - last;
      last = now;
    },
    set(name: string, ms: number) {
      marks[name] = ms;
    },
    total() {
      return Date.now() - start;
    },
    result(): Timings {
      return { ...marks, total_processing_ms: Date.now() - start };
    },
  };
}

/** Races a promise against a timeout so the customer never waits indefinitely. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
