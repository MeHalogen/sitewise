import { describe, expect, it } from 'vitest';
import { buildApiResult } from '../src/api/declarative.js';
import { builtinApiAdapters } from '../src/api/specs.js';
import { getPath, resolveUrl, toCell } from '../src/template.js';

describe('getPath', () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] }, list: ['x', 'y'] };
  it('reads nested keys', () => expect(getPath(obj, 'a.b.0.c')).toBe(1));
  it('reads array indices', () => expect(getPath(obj, 'list.1')).toBe('y'));
  it('returns undefined for missing paths', () => expect(getPath(obj, 'a.z.q')).toBeUndefined());
  it('returns the whole object for empty path', () => expect(getPath(obj, '')).toBe(obj));
});

describe('toCell', () => {
  it('joins arrays', () => expect(toCell(['a', 'b'])).toBe('a, b'));
  it('blanks null/undefined', () => expect(toCell(null)).toBe('') && expect(toCell(undefined)).toBe(''));
  it('stringifies numbers', () => expect(toCell(42)).toBe('42'));
});

describe('resolveUrl', () => {
  it('fills query and positional slots', () => {
    expect(resolveUrl('https://api/{0}?q={query}', ['pkg name'])).toBe('https://api/pkg%20name?q=pkg%20name');
  });
});

describe('buildApiResult', () => {
  it('maps a rooted array to rows', () => {
    const spec = {
      name: 'x',
      description: 'x',
      url: 'u',
      root: 'objects',
      item: { name: 'package.name', v: 'package.version' },
    };
    const payload = { objects: [{ package: { name: 'react', version: '19' } }, { package: { name: 'vue', version: '3' } }] };
    const result = buildApiResult(spec, payload, 20);
    expect(result.data).toEqual([
      { name: 'react', v: '19' },
      { name: 'vue', v: '3' },
    ]);
    expect(result.table?.rows).toHaveLength(2);
  });

  it('honors the limit', () => {
    const spec = { name: 'x', description: 'x', url: 'u', item: { n: 'n' } };
    const payload = [{ n: 1 }, { n: 2 }, { n: 3 }];
    expect((buildApiResult(spec, payload, 2).data as unknown[]).length).toBe(2);
  });

  it('renders text specs with labels', () => {
    const spec = { name: 'x', description: 'x', url: 'u', text: ['Name:info.name', 'Version:info.version'] };
    const result = buildApiResult(spec, { info: { name: 'flask', version: '3.0' } }, 1);
    expect(result.text).toBe('Name: flask\nVersion: 3.0');
  });

  it('drops empty labelled text lines', () => {
    const spec = { name: 'x', description: 'x', url: 'u', text: ['Name:info.name', 'Missing:info.nope'] };
    const result = buildApiResult(spec, { info: { name: 'flask' } }, 1);
    expect(result.text).toBe('Name: flask');
  });
});

describe('builtin api adapters', () => {
  it('are structurally valid and uniquely named', () => {
    const names = builtinApiAdapters.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const spec of builtinApiAdapters) {
      expect(spec.name).toMatch(/^[a-z]+$/);
      for (const cmd of spec.commands) {
        expect(cmd.url).toMatch(/^https?:\/\//);
        // every command must produce output somehow
        expect(Boolean(cmd.item) || Boolean(cmd.text)).toBe(true);
      }
    }
  });
});
