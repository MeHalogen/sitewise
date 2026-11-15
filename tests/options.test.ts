import { describe, expect, it } from 'vitest';
import { limitOverride, optionKey, resolveOptions, type AdapterCommand } from '../src/adapter.js';
import { describeCommands, findCommand } from '../src/registry.js';

const cmd: Pick<AdapterCommand, 'options'> = {
  options: [
    { flags: '-l, --limit <n>', description: 'rows', default: 15 },
    { flags: '-t, --time <window>', description: 'window', default: 'day' },
    { flags: '--dry-run', description: 'no default' },
  ],
};

describe('optionKey', () => {
  it('camelCases the long flag', () => {
    expect(optionKey('-l, --limit <n>')).toBe('limit');
    expect(optionKey('--dry-run')).toBe('dryRun');
  });
});

describe('resolveOptions', () => {
  it('fills every declared default (the ask NaN bug)', () => {
    expect(resolveOptions(cmd)).toEqual({ limit: 15, time: 'day' });
  });

  it('applies overrides on top of defaults', () => {
    expect(resolveOptions(cmd, { time: 'week', dryRun: true })).toEqual({ limit: 15, time: 'week', dryRun: true });
  });

  it('ignores undefined overrides', () => {
    expect(resolveOptions(cmd, { limit: undefined })).toEqual({ limit: 15, time: 'day' });
  });

  it('rejects options the command does not declare, naming the valid ones', () => {
    expect(() => resolveOptions(cmd, { sort: 'new' })).toThrow(/unknown option "sort".*limit, time, dryRun/);
    expect(() => resolveOptions({}, { limit: 3 })).toThrow(/takes no options/);
  });

  it('gives every real code-adapter command a numeric limit', () => {
    for (const [site, command] of [['hackernews', 'top'], ['github', 'search'], ['arxiv', 'search'], ['crypto', 'top']]) {
      const c = findCommand(site, command)!;
      expect(Number.isNaN(Number(resolveOptions(c).limit)), `${site} ${command}`).toBe(false);
    }
  });
});

describe('limitOverride', () => {
  it('only passes limit to commands that take it', () => {
    expect(limitOverride(cmd, 5)).toEqual({ limit: 5 });
    expect(limitOverride({ options: [] }, 5)).toEqual({});
    expect(limitOverride(cmd, undefined)).toEqual({});
  });
});

describe('describeCommands', () => {
  it('exposes args and options so an agent can call correctly', () => {
    const all = describeCommands();
    const search = all.find((c) => c.site === 'hackernews' && c.command === 'search')!;
    expect(search.args).toEqual([{ name: 'query', required: true, description: 'search terms' }]);
    expect(search.options).toContainEqual({ name: 'limit', description: 'number of results', default: 15 });
  });
});
