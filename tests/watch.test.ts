import { describe, expect, it } from 'vitest';
import type { WatchSpec } from '../src/config.js';
import { evaluateWatch, parseEvery, rowKey } from '../src/watch.js';

const changeWatch: WatchSpec = { id: 'w1', site: 'hackernews', command: 'top' };
const priceWatch: WatchSpec = { id: 'w2', site: 'crypto', command: 'price', field: 'price', below: 60000 };

describe('evaluateWatch — change mode', () => {
  it('first run sets a baseline without triggering', () => {
    const e = evaluateWatch(changeWatch, [{ title: 'Story A', url: 'a' }]);
    expect(e.triggered).toBe(false);
    expect(e.message).toContain('baseline');
    expect(e.state.lastKey).toBeDefined();
  });

  it('triggers when the top row identity changes', () => {
    const first = evaluateWatch(changeWatch, [{ title: 'Story A', url: 'a' }]);
    const second = evaluateWatch(changeWatch, [{ title: 'Story B', url: 'b' }], first.state);
    expect(second.triggered).toBe(true);
    expect(second.message).toContain('Story B');
  });

  it('stays quiet when nothing changed', () => {
    const first = evaluateWatch(changeWatch, [{ title: 'Story A', url: 'a' }]);
    const second = evaluateWatch(changeWatch, [{ title: 'Story A', url: 'a' }], first.state);
    expect(second.triggered).toBe(false);
  });
});

describe('evaluateWatch — threshold mode', () => {
  it('triggers on entering the zone, once', () => {
    const above = evaluateWatch(priceWatch, [{ price: 65000 }]);
    expect(above.triggered).toBe(false);
    const dip = evaluateWatch(priceWatch, [{ price: 59000 }], above.state);
    expect(dip.triggered).toBe(true);
    const stillLow = evaluateWatch(priceWatch, [{ price: 58000 }], dip.state);
    expect(stillLow.triggered).toBe(false); // edge-triggered: no repeat spam
    const recovered = evaluateWatch(priceWatch, [{ price: 61000 }], stillLow.state);
    expect(recovered.triggered).toBe(false);
    const dipsAgain = evaluateWatch(priceWatch, [{ price: 59500 }], recovered.state);
    expect(dipsAgain.triggered).toBe(true); // re-arms after leaving the zone
  });

  it('parses numeric strings with symbols', () => {
    const e = evaluateWatch(priceWatch, [{ price: '$59,000.50' }]);
    expect(e.triggered).toBe(true);
    expect(e.message).toContain('59000.5');
  });

  it('reports non-numeric fields without triggering', () => {
    const e = evaluateWatch(priceWatch, [{ price: 'n/a' }]);
    expect(e.triggered).toBe(false);
    expect(e.message).toContain('not numeric');
  });

  it('supports above thresholds', () => {
    const w: WatchSpec = { id: 'w3', site: 'crypto', command: 'price', field: 'price', above: 70000 };
    const below = evaluateWatch(w, [{ price: 65000 }]);
    const crossed = evaluateWatch(w, [{ price: 71000 }], below.state);
    expect(below.triggered).toBe(false);
    expect(crossed.triggered).toBe(true);
  });
});

describe('helpers', () => {
  it('rowKey prefers stable identity fields', () => {
    expect(rowKey({ points: 1, url: 'https://x', title: 'T' })).toBe('url:https://x');
    expect(rowKey({ foo: 'bar' })).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('parseEvery handles s/m/h with fallback', () => {
    expect(parseEvery('30s', 0)).toBe(30_000);
    expect(parseEvery('15m', 0)).toBe(900_000);
    expect(parseEvery('2h', 0)).toBe(7_200_000);
    expect(parseEvery('nonsense', 123)).toBe(123);
    expect(parseEvery(undefined, 456)).toBe(456);
  });

  it('empty rows never trigger', () => {
    expect(evaluateWatch(changeWatch, []).triggered).toBe(false);
  });
});
