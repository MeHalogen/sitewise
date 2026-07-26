import { afterEach, describe, expect, it, vi } from 'vitest';
import { postWebhook } from '../src/notify.js';

afterEach(() => vi.unstubAllGlobals());

describe('postWebhook', () => {
  it('POSTs JSON with both text and content keys (Slack + Discord)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    const ok = await postWebhook('https://hooks.example/abc', 'bitcoin', 'price = 59000');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example/abc');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe('bitcoin: price = 59000');
    expect(body.content).toBe('bitcoin: price = 59000');
  });

  it('returns false and never throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(postWebhook('https://x', 't', 'm')).resolves.toBe(false);
  });

  it('returns false on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    expect(await postWebhook('https://x', 't', 'm')).toBe(false);
  });
});
