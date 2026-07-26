import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readHistory, recordHistory } from '../src/history.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'sitewise-hist-'));
  process.env.SITEWISE_CONFIG_DIR = dir;
});

afterAll(() => {
  delete process.env.SITEWISE_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('history store', () => {
  it('records and reads back list results, newest first', () => {
    recordHistory('crypto', 'top', [], [{ symbol: 'BTC', price: 1 }]);
    recordHistory('crypto', 'top', [], [{ symbol: 'BTC', price: 2 }]);
    const entries = readHistory('crypto', 'top');
    expect(entries).toHaveLength(2);
    expect((entries[0].rows[0] as { price: number }).price).toBe(2); // newest first
  });

  it('ignores non-array / empty results', () => {
    recordHistory('x', 'y', [], { not: 'an array' });
    recordHistory('x', 'y', [], []);
    expect(readHistory('x', 'y')).toHaveLength(0);
  });

  it('honors the limit', () => {
    recordHistory('a', 'b', [], [{ v: 1 }]);
    recordHistory('a', 'b', [], [{ v: 2 }]);
    recordHistory('a', 'b', [], [{ v: 3 }]);
    expect(readHistory('a', 'b', { limit: 2 })).toHaveLength(2);
  });

  it('filters with grep', () => {
    recordHistory('news', 'top', [], [{ title: 'Rust release' }]);
    recordHistory('news', 'top', [], [{ title: 'Go release' }]);
    const rust = readHistory('news', 'top', { grep: 'rust' });
    expect(rust).toHaveLength(1);
    expect((rust[0].rows[0] as { title: string }).title).toContain('Rust');
  });

  it('returns empty for unknown commands', () => {
    expect(readHistory('nope', 'nope')).toEqual([]);
  });
});
