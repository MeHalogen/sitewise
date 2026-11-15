import { VERSION } from './version.js';

const USER_AGENT = `sitewise/${VERSION} (+https://github.com/MeHalogen/sitewise)`;
const DEFAULT_TIMEOUT_MS = 15_000;

/** Tunables, exported so tests can make retries instant. */
export const httpConfig = { retryDelayMs: 1_000, maxRetryDelayMs: 5_000 };

const NEXT_STEP = 'Run `sitewise doctor --adapters` to see which sites are affected.';

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** A plain-language reason for a failed request, plus what to do about it. */
export function explainStatus(status: number, url: string): string {
  const h = host(url);
  if (status === 401 || status === 403)
    return `${h} refused the request (HTTP ${status}). The site may have started blocking automated clients. ${NEXT_STEP}`;
  if (status === 404) return `${h} has no such page (HTTP 404). Check the name or argument you passed.`;
  if (status === 429) return `${h} is rate-limiting requests (HTTP 429). Wait a minute and try again.`;
  if (status >= 500) return `${h} is having trouble on its side (HTTP ${status}). Try again shortly. ${NEXT_STEP}`;
  return `${h} returned HTTP ${status}.`;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(explainStatus(status, url));
    this.name = 'HttpError';
  }
}

/** The site did not answer (timeout) or could not be reached (DNS, connection refused, offline). */
export class NetworkError extends Error {
  constructor(
    public readonly url: string,
    public readonly kind: 'timeout' | 'unreachable',
    timeoutMs: number,
  ) {
    super(
      kind === 'timeout'
        ? `${host(url)} did not respond within ${Math.round(timeoutMs / 1000)}s. It may be slow or down. ${NEXT_STEP}`
        : `Could not reach ${host(url)}. Check your internet connection, then try again.`,
    );
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  timeoutMs?: number;
}

function retryable(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  return err instanceof HttpError && (err.status === 429 || err.status >= 500);
}

function retryDelay(res: Response | undefined): number {
  const header = Number(res?.headers.get('retry-after'));
  const asked = Number.isFinite(header) && header > 0 ? header * 1000 : httpConfig.retryDelayMs;
  return Math.min(asked, httpConfig.maxRetryDelayMs);
}

async function attempt(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
  } catch (err) {
    const name = (err as Error)?.name;
    throw new NetworkError(url, name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable', timeoutMs);
  }
  if (!res.ok) {
    const error = new HttpError(res.status, url);
    (error as HttpError & { response?: Response }).response = res;
    throw error;
  }
  return res;
}

/** GET with one retry (after a short backoff) on 429, 5xx, timeouts and connection failures. */
async function request(url: string, headers: Record<string, string> = {}, opts: RequestOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    return await attempt(url, headers, timeoutMs);
  } catch (err) {
    if (!retryable(err)) throw err;
    const res = (err as { response?: Response }).response;
    await new Promise((r) => setTimeout(r, retryDelay(res)));
    return await attempt(url, headers, timeoutMs);
  }
}

export async function getJSON<T = unknown>(url: string, headers?: Record<string, string>, opts?: RequestOptions): Promise<T> {
  const res = await request(url, { accept: 'application/json', ...headers }, opts);
  return (await res.json()) as T;
}

export async function getText(url: string, headers?: Record<string, string>, opts?: RequestOptions): Promise<string> {
  const res = await request(url, headers, opts);
  return await res.text();
}
