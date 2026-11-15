import { describe, expect, it } from 'vitest';
import type { Adapter, AdapterCommand } from '../src/adapter.js';
import { badgeFor, runHealth, summarize } from '../src/health.js';
import { reportUrl } from '../src/report.js';
import { adapters } from '../src/registry.js';

function cmd(name: string, run: AdapterCommand['run'], extra: Partial<AdapterCommand> = {}): AdapterCommand {
  return { name, description: name, options: [{ flags: '-l, --limit <n>', description: 'n', default: 20 }], run, ...extra };
}

const rows = (n: number) => async () => ({ data: Array.from({ length: n }, (_, i) => ({ title: `r${i}` })) });

describe('runHealth', () => {
  it('classifies ok, empty, failing and skipped commands', async () => {
    const site: Adapter = {
      name: 'demo',
      description: 'demo',
      commands: [
        cmd('good', rows(3)),
        cmd('empty', rows(0)),
        cmd('broken', async () => {
          throw new Error('example.com refused the request (HTTP 403).');
        }),
        cmd('noexample', rows(3), { args: [{ name: '<query>', description: 'q' }] }),
        cmd('text', async () => ({ data: {}, text: 'Title: x' }), { options: [] }),
      ],
    };
    const results = await runHealth([site]);
    const by = Object.fromEntries(results.map((r) => [r.command, r]));
    expect(by.good.status).toBe('ok');
    expect(by.empty.status).toBe('empty');
    expect(by.broken.status).toBe('fail');
    expect(by.broken.report).toContain('issues/new');
    expect(by.noexample.status).toBe('skipped');
    expect(by.text.status).toBe('ok');
    expect(summarize(results)).toEqual({ total: 4, ok: 2, broken: 2, skipped: 1 });
  });

  it('passes the example args and a small limit', async () => {
    const seen: unknown[] = [];
    const site: Adapter = {
      name: 's',
      description: 's',
      commands: [cmd('search', async (ctx) => (seen.push(ctx), { data: [{ a: 1 }] }), { args: [{ name: '<q>', description: 'q' }], example: ['rust'] })],
    };
    await runHealth([site]);
    expect(seen[0]).toEqual({ args: ['rust'], opts: { limit: 3 } });
  });

  it('confirms a failure before reporting it, so a one-off blip is not "broken"', async () => {
    let calls = 0;
    const site: Adapter = {
      name: 's',
      description: 's',
      commands: [
        cmd('blip', async () => {
          if (calls++ === 0) throw new Error('HTTP 503');
          return { data: [{ a: 1 }] };
        }),
      ],
    };
    const [r] = await runHealth([site]);
    expect(r.status).toBe('ok');
    expect(r.flaky).toBe(true);
  });

  it('skips browser adapters unless asked, and experimental ones always', async () => {
    const run = rows(1);
    const browser: Adapter = { name: 'b', description: 'b', mode: 'browser', commands: [cmd('x', run)] };
    const exp: Adapter = { name: 'e', description: 'e', mode: 'browser', experimental: true, commands: [cmd('x', run)] };
    expect(await runHealth([browser, exp])).toHaveLength(0);
    expect((await runHealth([browser, exp], { browser: true })).map((r) => r.site)).toEqual(['b']);
  });

  it('filters by site', async () => {
    const a: Adapter = { name: 'a', description: 'a', commands: [cmd('x', rows(1))] };
    const b: Adapter = { name: 'b', description: 'b', commands: [cmd('x', rows(1))] };
    expect((await runHealth([a, b], { only: ['b'] })).map((r) => r.site)).toEqual(['b']);
  });
});

describe('badge', () => {
  it('summarizes for shields.io', () => {
    const ok = { site: 'a', command: 'x', mode: 'api' as const, args: [], status: 'ok' as const, ms: 1 };
    expect(badgeFor([ok, ok])).toEqual({ schemaVersion: 1, label: 'adapters', message: '2/2 healthy', color: 'brightgreen' });
    expect(badgeFor([ok, { ...ok, status: 'fail' }]).color).toBe('red');
  });
});

describe('examples', () => {
  it('every built-in command with required args has an example', () => {
    for (const a of adapters) {
      for (const c of a.commands) {
        const required = (c.args ?? []).filter((x) => x.name.startsWith('<')).length;
        expect((c.example ?? []).length, `${a.name} ${c.name}`).toBeGreaterThanOrEqual(required);
      }
    }
  });
});

describe('reportUrl', () => {
  it('prefills the broken-adapter template without sending anything', () => {
    const url = new URL(reportUrl('npm', 'search', 'HTTP 403', ['react']));
    expect(url.pathname).toBe('/MeHalogen/sitewise/issues/new');
    expect(url.searchParams.get('template')).toBe('broken-adapter.yml');
    expect(url.searchParams.get('title')).toBe('[broken] npm search');
    expect(url.searchParams.get('body')).toContain('sitewise npm search react');
  });
});
