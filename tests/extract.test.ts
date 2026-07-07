import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractRows } from '../src/browser/extract.js';

function doc(html: string) {
  return new JSDOM(html).window.document;
}

const LISTING = `
<ul id="feed">
  <li class="item">
    <a class="title" href="/a">First story</a>
    <span class="score">128</span>
    <span class="meta">  by   alice \n </span>
  </li>
  <li class="item">
    <a class="title" href="https://example.com/b">Second story</a>
    <span class="score">42</span>
    <span class="meta">by bob</span>
  </li>
  <li class="item">
    <a class="title" href="/c">Third story</a>
    <span class="score">7</span>
    <span class="meta">by carol</span>
  </li>
</ul>`;

describe('extractRows', () => {
  const spec = {
    selector: 'li.item',
    fields: {
      title: { selector: 'a.title' },
      url: { selector: 'a.title', attr: 'href' },
      score: { selector: '.score' },
      meta: { selector: '.meta' },
    },
  };

  it('extracts one row per item with text and attributes', () => {
    const rows = extractRows(doc(LISTING), spec);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ title: 'First story', url: '/a', score: '128', meta: 'by alice' });
    expect(rows[1].url).toBe('https://example.com/b');
  });

  it('collapses whitespace in text content', () => {
    const rows = extractRows(doc(LISTING), spec);
    expect(rows[0].meta).toBe('by alice');
  });

  it('honors the limit', () => {
    const rows = extractRows(doc(LISTING), { ...spec, limit: 2 });
    expect(rows).toHaveLength(2);
  });

  it('yields empty strings for missing fields instead of throwing', () => {
    const rows = extractRows(doc(LISTING), {
      selector: 'li.item',
      limit: 1,
      fields: { nope: { selector: '.does-not-exist' } },
    });
    expect(rows[0].nope).toBe('');
  });

  it('uses the item element itself when no field selector is given', () => {
    const rows = extractRows(doc('<div class="x">hello world</div>'), {
      selector: '.x',
      fields: { whole: {} },
    });
    expect(rows[0].whole).toBe('hello world');
  });

  it('returns no rows when nothing matches', () => {
    expect(extractRows(doc('<p>nothing</p>'), spec)).toEqual([]);
  });
});
