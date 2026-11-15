import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { explainStatus, getJSON, HttpError, httpConfig, NetworkError } from '../src/http.js';
import { VERSION } from '../src/version.js';
import pkg from '../package.json' with { type: 'json' };

const realFetch = globalThis.fetch;
let calls: { url: string; ua: string }[] = [];

function fakeFetch(...responses: (Response | Error)[]) {
  calls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), ua: String((init?.headers as Record<string, string>)['user-agent']) });
    const next = responses.shift() ?? new Response('{}');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
}

beforeEach(() => {
  httpConfig.retryDelayMs = 0;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  httpConfig.retryDelayMs = 1_000;
});

describe('http retry', () => {
  it('retries once on 5xx, then succeeds', async () => {
    fakeFetch(new Response('', { status: 503 }), new Response('{"ok":true}'));
    await expect(getJSON('https://api.example.com/x')).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('retries once on 429 and gives up after the second failure', async () => {
    fakeFetch(new Response('', { status: 429 }), new Response('', { status: 429 }));
    await expect(getJSON('https://api.example.com/x')).rejects.toThrow(/rate-limiting/);
    expect(calls).toHaveLength(2);
  });

  it('does not retry a 403', async () => {
    fakeFetch(new Response('', { status: 403 }));
    await expect(getJSON('https://api.example.com/x')).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(1);
  });

  it('retries a timeout, then reports it plainly', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    fakeFetch(timeout, timeout);
    const err = await getJSON('https://slow.example.com/x').catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toMatch(/slow\.example\.com did not respond within 15s.*doctor --adapters/);
    expect(calls).toHaveLength(2);
  });

  it('reports an unreachable host as a connection problem', async () => {
    fakeFetch(new TypeError('fetch failed'), new TypeError('fetch failed'));
    await expect(getJSON('https://nope.example.com')).rejects.toThrow(/Could not reach nope\.example\.com/);
  });
});

describe('explainStatus', () => {
  it('names the host and the next step', () => {
    expect(explainStatus(403, 'https://www.reddit.com/r/all.json')).toMatch(/^www\.reddit\.com refused .*doctor --adapters/);
    expect(explainStatus(404, 'https://x.io/a')).toMatch(/Check the name/);
    expect(explainStatus(502, 'https://x.io/a')).toMatch(/trouble on its side/);
  });
});

describe('version', () => {
  it('comes from package.json and is sent in the user-agent', async () => {
    expect(VERSION).toBe(pkg.version);
    fakeFetch(new Response('{}'));
    await getJSON('https://api.example.com/x');
    expect(calls[0].ua).toBe(`sitewise/${pkg.version} (+https://github.com/MeHalogen/sitewise)`);
  });
});
