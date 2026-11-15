import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createHealingRunner } from '../src/browser/autoheal.js';
import type { BrowserAdapterSpec } from '../src/browser/declarative.js';
import { extractRows } from '../src/browser/extract.js';
import type { LLM } from '../src/llm.js';

const adapter: BrowserAdapterSpec = {
  name: 'shop',
  description: 'shop',
  commands: [
    {
      name: 'list',
      description: 'items',
      url: 'https://shop.example',
      list: { selector: '.old-item', limit: 10, fields: { title: { selector: '.old-title' } } },
    },
  ],
};
const cmd = adapter.commands[0];
const NEW_HTML = '<main><article class="card"><h3>First</h3></article><article class="card"><h3>Second</h3></article></main>';

/** Runs the real extractor against fixed HTML, like the browser would. */
const run = vi.fn(async (spec: typeof cmd) => ({
  rows: extractRows(new JSDOM(NEW_HTML).window.document, spec.list),
  html: NEW_HTML,
}));
const llm = (reply: unknown): (() => LLM) => () => ({ json: vi.fn(async () => reply) as LLM['json'] });
const good = { selector: 'article.card', fields: { title: { selector: 'h3' } } };

describe('auto-heal', () => {
  it('repairs, saves the adapter and returns the rows in the same run', async () => {
    const persist = vi.fn(() => '/tmp/shop.yaml');
    const notices: string[] = [];
    const runner = createHealingRunner(adapter, 9222, { run, llm: llm(good), persist, enabled: () => true, notice: (l) => notices.push(l) });
    const rows = await runner(cmd, cmd.url);
    expect(rows.map((r) => r.title)).toEqual(['First', 'Second']);
    expect(persist).toHaveBeenCalledOnce();
    const saved = persist.mock.calls[0][0] as BrowserAdapterSpec;
    expect(saved.name).toBe('shop');
    expect(saved.commands[0].list.selector).toBe('article.card');
    expect(notices.at(-1)).toMatch(/repaired shop list \(2 rows\); saved to \/tmp\/shop\.yaml/);
  });

  it('never saves a repair that does not extract rows', async () => {
    const persist = vi.fn(() => 'x');
    const runner = createHealingRunner(adapter, 9222, {
      run,
      llm: llm({ selector: '.nothing', fields: { title: {} } }),
      persist,
      enabled: () => true,
      notice: () => {},
    });
    expect(await runner(cmd, cmd.url)).toEqual([]);
    expect(persist).not.toHaveBeenCalled();
  });

  it('does nothing when disabled (no key, or SITEWISE_AUTOHEAL=0)', async () => {
    const model = vi.fn();
    const runner = createHealingRunner(adapter, 9222, { run, llm: model as never, enabled: () => false, notice: () => {} });
    expect(await runner(cmd, cmd.url)).toEqual([]);
    expect(model).not.toHaveBeenCalled();
  });

  it('does not call the model when the command already works', async () => {
    const model = vi.fn();
    const healthy = { ...cmd, list: { ...cmd.list, selector: 'article.card', fields: { title: { selector: 'h3' } } } };
    const runner = createHealingRunner(adapter, 9222, { run, llm: model as never, enabled: () => true, notice: () => {} });
    expect(await runner(healthy, cmd.url)).toHaveLength(2);
    expect(model).not.toHaveBeenCalled();
  });

  it('respects SITEWISE_AUTOHEAL=0 even with a key', async () => {
    const { autoHealEnabled } = await import('../src/browser/autoheal.js');
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    vi.stubEnv('SITEWISE_AUTOHEAL', '0');
    expect(autoHealEnabled()).toBe(false);
    vi.stubEnv('SITEWISE_AUTOHEAL', '');
    expect(autoHealEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
