import { describe, expect, it, vi } from 'vitest';
import { loadBrowserAdapter, resolveUrl, type BrowserAdapterSpec } from '../src/browser/declarative.js';
import { builtinBrowserAdapters } from '../src/adapters/web/specs.js';

describe('resolveUrl', () => {
  it('substitutes {query} with url-encoded joined args', () => {
    expect(resolveUrl('https://x.com/search?q={query}', ['hello', 'world'])).toBe(
      'https://x.com/search?q=hello%20world',
    );
  });

  it('substitutes positional {0}/{1}', () => {
    expect(resolveUrl('https://x.com/{0}/status/{1}', ['jack', '123'])).toBe('https://x.com/jack/status/123');
  });

  it('encodes unsafe characters', () => {
    expect(resolveUrl('https://x.com/{0}', ['a/b?c'])).toBe('https://x.com/a%2Fb%3Fc');
  });
});

describe('loadBrowserAdapter', () => {
  const spec: BrowserAdapterSpec = {
    name: 'demo',
    description: 'demo adapter',
    commands: [
      {
        name: 'search',
        description: 'search demo',
        url: 'https://demo.test/s?q={query}',
        args: [{ name: '<query>', description: 'q' }],
        list: { selector: '.item', limit: 10, fields: { title: { selector: '.t' } } },
      },
    ],
  };

  it('builds an Adapter marked as browser mode', () => {
    const adapter = loadBrowserAdapter(spec, async () => []);
    expect(adapter.mode).toBe('browser');
    expect(adapter.commands[0].name).toBe('search');
  });

  it('resolves the URL and passes limit through to the runner', async () => {
    const runner = vi.fn(async () => [{ title: 'hit' }]);
    const adapter = loadBrowserAdapter(spec, runner);
    const result = await adapter.commands[0].run({ args: ['node', 'js'], opts: { limit: 3 } });

    expect(runner).toHaveBeenCalledOnce();
    const [passedSpec, url] = runner.mock.calls[0];
    expect(url).toBe('https://demo.test/s?q=node%20js');
    expect(passedSpec.list.limit).toBe(3);
    expect(result.data).toEqual([{ title: 'hit' }]);
    expect(result.table?.columns.map((c) => c.key)).toEqual(['title']);
  });
});

describe('builtin browser adapters', () => {
  it('are structurally valid', () => {
    for (const spec of builtinBrowserAdapters) {
      expect(spec.name).toMatch(/^[a-z]+$/);
      expect(spec.commands.length).toBeGreaterThan(0);
      for (const cmd of spec.commands) {
        expect(cmd.url).toContain('http');
        expect(cmd.list.selector.length).toBeGreaterThan(0);
        expect(Object.keys(cmd.list.fields).length).toBeGreaterThan(0);
      }
    }
  });

  it('have unique names not colliding with each other', () => {
    const names = builtinBrowserAdapters.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
