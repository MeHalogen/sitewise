const USER_AGENT = 'sitewise/1.0 (+https://github.com/MeHalogen/sitewise)';
const DEFAULT_TIMEOUT_MS = 15_000;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}`);
    this.name = 'HttpError';
  }
}

async function request(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJSON<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await request(url, { accept: 'application/json', ...headers });
  return (await res.json()) as T;
}

export async function getText(url: string, headers?: Record<string, string>): Promise<string> {
  const res = await request(url, headers);
  return await res.text();
}
