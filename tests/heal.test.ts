import { describe, expect, it, vi } from 'vitest';
import type { BrowserCommandSpec } from '../src/browser/declarative.js';
import { applyHeal } from '../src/browser/heal-store.js';
import { buildHealPrompt, condenseHtml, countUsableRows, healAgainstHtml, type HealProposal } from '../src/browser/heal.js';
import { parseJsonReply } from '../src/llm.js';
import type { LLM } from '../src/llm.js';

const spec: BrowserCommandSpec = {
  name: 'today',
  description: 'Top items',
  url: 'https://example.com',
  waitFor: '.old-item',
  list: {
    selector: '.old-item', // stale — no longer matches
    limit: 20,
    fields: { title: { selector: '.old-title' }, url: { selector: 'a', attr: 'href' } },
  },
};

// The page's markup changed: items are now <article class="card"> with <h3> titles.
const NEW_HTML = `
  <main>
    <article class="card"><h3>First</h3><a href="/1">link</a></article>
    <article class="card"><h3>Second</h3><a href="/2">link</a></article>
  </main>`;

const goodProposal: HealProposal = {
  selector: 'article.card',
  fields: { title: { selector: 'h3' }, url: { selector: 'a', attr: 'href' } },
};

function fakeLLM(reply: unknown): LLM {
  return { json: vi.fn(async () => reply) as LLM['json'] };
}

describe('condenseHtml', () => {
  it('strips scripts/styles and collapses whitespace', () => {
    const out = condenseHtml('<style>a{}</style><script>x()</script><div>  hi   there </div>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('style');
    expect(out).toContain('hi there');
  });

  it('caps length', () => {
    expect(condenseHtml('x'.repeat(50), 10).length).toBeLessThanOrEqual(30);
  });
});

describe('buildHealPrompt', () => {
  it('mentions every field and the old selector', () => {
    const p = buildHealPrompt(spec, NEW_HTML);
    expect(p).toContain('title');
    expect(p).toContain('url');
    expect(p).toContain('.old-item');
    expect(p).toContain('JSON');
  });
});

describe('parseJsonReply', () => {
  it('handles fenced JSON', () => {
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('extracts JSON embedded in prose', () => {
    expect(parseJsonReply('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });
  it('handles bare JSON', () => {
    expect(parseJsonReply('[1,2,3]')).toEqual([1, 2, 3]);
  });
});

describe('healAgainstHtml', () => {
  it('accepts a proposal only after it verifies against the real DOM', async () => {
    const result = await healAgainstHtml(fakeLLM(goodProposal), spec, NEW_HTML);
    expect(result.healed).toBe(true);
    expect(countUsableRows(result.rows)).toBe(2);
    expect(result.rows[0].title).toBe('First');
    expect(result.rows[0].url).toBe('/1');
  });

  it('REJECTS a hallucinated proposal that extracts nothing', async () => {
    const bogus: HealProposal = { selector: '.does-not-exist', fields: { title: {} } };
    const result = await healAgainstHtml(fakeLLM(bogus), spec, NEW_HTML);
    expect(result.healed).toBe(false);
    expect(result.reason).toMatch(/no data/i);
  });

  it('fails gracefully when the model errors', async () => {
    const throwing: LLM = { json: vi.fn(async () => { throw new Error('boom'); }) };
    const result = await healAgainstHtml(throwing, spec, NEW_HTML);
    expect(result.healed).toBe(false);
    expect(result.reason).toBe('boom');
  });
});

describe('applyHeal', () => {
  it('replaces only the target command\'s selectors and updates waitFor', () => {
    const adapter = { name: 'demo', description: 'd', commands: [spec, { ...spec, name: 'other' }] };
    const healed = applyHeal(adapter, 'today', goodProposal);
    const today = healed.commands.find((c) => c.name === 'today')!;
    const other = healed.commands.find((c) => c.name === 'other')!;
    expect(today.list.selector).toBe('article.card');
    expect(today.waitFor).toBe('article.card');
    expect(other.list.selector).toBe('.old-item'); // untouched
  });
});
