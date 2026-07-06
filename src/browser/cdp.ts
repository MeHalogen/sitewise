import WebSocket from 'ws';

/** Minimal Chrome DevTools Protocol client over a per-target WebSocket. */

export interface CdpTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

export const DEFAULT_CDP_PORT = 9222;

export async function listTargets(port = DEFAULT_CDP_PORT): Promise<CdpTarget[]> {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`CDP endpoint returned HTTP ${res.status}`);
  return (await res.json()) as CdpTarget[];
}

export async function isBrowserRunning(port = DEFAULT_CDP_PORT): Promise<boolean> {
  try {
    await listTargets(port);
    return true;
  } catch {
    return false;
  }
}

export class CdpSession {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private events: ((method: string, params: unknown) => void)[] = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.message} (CDP ${msg.error.code})`));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.events) fn(msg.method, msg.params);
      }
    });
    ws.on('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('CDP connection closed'));
      this.pending.clear();
    });
  }

  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return new CdpSession(ws);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  onEvent(fn: (method: string, params: unknown) => void): void {
    this.events.push(fn);
  }

  /** Resolve when a CDP event fires, or reject after timeoutMs. */
  waitForEvent(method: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      this.onEvent((m, params) => {
        if (m === method) {
          clearTimeout(timer);
          resolve(params);
        }
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}

/** Evaluate a JS expression in the page; throws on page-side exceptions. */
export async function evaluate<T = unknown>(session: CdpSession, expression: string): Promise<T> {
  const res = await session.send<{
    result: { type: string; value?: T; description?: string };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  }
  return res.result.value as T;
}
