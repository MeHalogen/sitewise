import { describe, expect, it, vi } from 'vitest';
import { authorWithLLM, buildAuthorPrompt, verifyAndBuild, type AuthorRequest } from '../src/browser/author.js';
import type { HealProposal } from '../src/browser/heal.js';
import type { LLM } from '../src/llm.js';

const req: AuthorRequest = { site: 'shop', command: 'list', url: 'https://shop.test', want: ['title', 'price'] };

const HTML = `
  <ul>
    <li class="product"><span class="name">Widget</span><span class="cost">$9</span></li>
    <li class="product"><span class="name">Gadget</span><span class="cost">$19</span></li>
  </ul>`;

const goodProposal: HealProposal = {
  selector: 'li.product',
  fields: { title: { selector: '.name' }, price: { selector: '.cost' } },
};

const fakeLLM = (reply: unknown): LLM => ({ json: vi.fn(async () => reply) });

describe('buildAuthorPrompt', () => {
  it('lists the wanted fields', () => {
    const p = buildAuthorPrompt(req, HTML);
    expect(p).toContain('title, price');
    expect(p).toContain('JSON');
  });
});

describe('verifyAndBuild', () => {
  it('builds a valid adapter spec when selectors extract data', () => {
    const result = verifyAndBuild(req, goodProposal, HTML);
    expect(result.ok).toBe(true);
    expect(result.spec?.name).toBe('shop');
    expect(result.spec?.commands[0].name).toBe('list');
    expect(result.spec?.commands[0].list.selector).toBe('li.product');
    expect(result.spec?.commands[0].columns).toEqual(['title', 'price']);
    expect(result.rows[0]).toEqual({ title: 'Widget', price: '$9' });
  });

  it('rejects selectors that extract nothing', () => {
    const result = verifyAndBuild(req, { selector: '.nope', fields: { title: {} } }, HTML);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no data/i);
  });

  it('rejects an empty proposal', () => {
    expect(verifyAndBuild(req, {} as HealProposal, HTML).ok).toBe(false);
  });
});

describe('authorWithLLM', () => {
  it('verifies the model proposal before returning a spec', async () => {
    const result = await authorWithLLM(fakeLLM(goodProposal), req, HTML);
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it('rejects a hallucinated proposal', async () => {
    const result = await authorWithLLM(fakeLLM({ selector: '.ghost', fields: { title: {} } }), req, HTML);
    expect(result.ok).toBe(false);
  });
});
