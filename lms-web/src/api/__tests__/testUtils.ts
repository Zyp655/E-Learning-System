import { vi } from 'vitest';

/** Minimal window.localStorage for the node test environment. */
export function installLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const localStorage = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string): void => {
      data.set(k, String(v));
    },
    removeItem: (k: string): void => {
      data.delete(k);
    },
    clear: () => data.clear(),
  };
  vi.stubGlobal('window', { localStorage });
  return data;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Response whose body yields the given string chunks one read() at a time. */
export function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Stubs global fetch with a handler and records every call. */
export function mockFetch(handler: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      url: String(input),
      method: (init?.method || 'GET').toUpperCase(),
      headers: (init?.headers as Record<string, string>) || {},
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

export const networkDown = (): never => {
  throw new TypeError('fetch failed');
};
