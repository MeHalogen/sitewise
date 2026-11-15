import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApiAdapter } from '../src/api/declarative.js';
import { builtinApiAdapters } from '../src/api/specs.js';
import { loadBrowserAdapter, type BrowserCommandSpec } from '../src/browser/declarative.js';
import { builtinBrowserAdapters } from '../src/adapters/web/specs.js';
import { resolveOptions } from '../src/adapter.js';
import { listCommands } from '../src/registry.js';
import { resolveUrl } from '../src/template.js';
import { httpConfig } from '../src/http.js';

describe('resolveUrl defaults and named values', () => {
  it('uses {0|default} when the arg is missing', () => {
    expect(resolveUrl('https://x/r/{0|all}/hot', [])).toBe('https://x/r/all/hot');
    expect(resolveUrl('https://x/r/{0|all}/hot', ['rust'])).toBe('https://x/r/rust/hot');
  });
  it('fills named option values and leaves unknown placeholders', () => {
    expect(resolveUrl('https://x?t={time}&k={key}', [], { time: 'week' })).toBe('https://x?t=week&k={key}');
  });
});

describe('reddit (browser engine)', () => {
  const spec = builtinBrowserAdapters.find((s) => s.name === 'reddit')!;

  it('is a browser adapter marked experimental', () => {
    expect(spec.experimental).toBe(true);
    expect(listCommands().find((c) => c.site === 'reddit')?.mode).toBe('browser (experimental)');
  });

  it('passes --time and the subreddit into the URL', async () => {
    const seen: string[] = [];
    const runner = async (_: BrowserCommandSpec, url: string) => {
      seen.push(url);
      return [{ title: 't', score: '1' }];
    };
    const top = loadBrowserAdapter(spec, runner).commands.find((c) => c.name === 'top')!;
    await top.run({ args: ['rust'], opts: resolveOptions(top, { time: 'week' }) });
    await top.run({ args: [], opts: resolveOptions(top) });
    expect(seen).toEqual(['https://www.reddit.com/r/rust/top/?t=week', 'https://www.reddit.com/r/all/top/?t=day']);
  });
});

describe('nasa key', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllEnvs();
  });
  const apod = () => loadApiAdapter(builtinApiAdapters.find((a) => a.name === 'nasa')!).commands[0];

  it('uses NASA_API_KEY when set', async () => {
    vi.stubEnv('NASA_API_KEY', 'mine');
    let seen = '';
    globalThis.fetch = (async (url: string) => {
      seen = String(url);
      return new Response('{"title":"x"}');
    }) as typeof fetch;
    await apod().run({ args: [], opts: {} });
    expect(seen).toContain('api_key=mine');
  });

  it('falls back to DEMO_KEY and explains a failure', async () => {
    httpConfig.retryDelayMs = 0;
    vi.stubEnv('NASA_API_KEY', '');
    globalThis.fetch = (async () => new Response('busy', { status: 500 })) as typeof fetch;
    await expect(apod().run({ args: [], opts: {} })).rejects.toThrow(/NASA_API_KEY/);
  });
});

describe('dead adapters', () => {
  it('gutenberg is gone', () => {
    expect(builtinApiAdapters.some((a) => a.name === 'gutenberg')).toBe(false);
  });
  it('art identifies itself the way the AIC API asks', () => {
    const art = builtinApiAdapters.find((a) => a.name === 'art')!.commands[0];
    expect(art.headers?.['AIC-User-Agent']).toMatch(/sitewise/);
  });
});
