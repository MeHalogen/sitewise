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

/** WebSocket URL for the browser itself (needed to create/attach tabs). */
export async function getBrowserWsUrl(port = DEFAULT_CDP_PORT): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`CDP endpoint returned HTTP ${res.status}`);
  const info = (await res.json()) as { webSocketDebuggerUrl?: string };
  if (!info.webSocketDebuggerUrl) throw new Error('Browser CDP endpoint did not report a WebSocket URL.');
  return info.webSocketDebuggerUrl;
}

export class CdpSession {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private events: ((method: string, params: unknown, sessionId?: string) => void)[] = [];

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
        for (const fn of this.events) fn(msg.method, msg.params, msg.sessionId);
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

  send<T = unknown>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params });
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

  onEvent(fn: (method: string, params: unknown, sessionId?: string) => void): void {
    this.events.push(fn);
  }

  /** Resolve when a CDP event fires (optionally for a specific attached session), or reject after timeoutMs. */
  waitForEvent(method: string, timeoutMs: number, sessionId?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      this.onEvent((m, params, sid) => {
        if (m === method && (sessionId === undefined || sid === sessionId)) {
          clearTimeout(timer);
          resolve(params);
        }
      });
    });
  }

  /** Attach to a target as a flat session and return its sessionId. */
  async attachToTarget(targetId: string): Promise<string> {
    const res = await this.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    return res.sessionId;
  }

  close(): void {
    this.ws.close();
  }
}

/** Evaluate a JS expression in the page; throws on page-side exceptions. */
export async function evaluate<T = unknown>(session: CdpSession, expression: string, sessionId?: string): Promise<T> {
  const res = await session.send<{
    result: { type: string; value?: T; description?: string };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  }
  return res.result.value as T;
}
