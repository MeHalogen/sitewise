import { describe, expect, it, vi } from 'vitest';
import { buildRoutePrompt, route, validateRoute, type CommandInfo } from '../src/ask.js';
import type { LLM } from '../src/llm.js';

const catalog: CommandInfo[] = [
  { site: 'hackernews', command: 'top', description: 'Front-page stories' },
  { site: 'weather', command: 'now', description: 'Current conditions for a city' },
  { site: 'github', command: 'search', description: 'Search repositories' },
];

const fakeLLM = (reply: unknown): LLM => ({ json: vi.fn(async () => reply) });

describe('buildRoutePrompt', () => {
  it('includes the catalog and the query', () => {
    const p = buildRoutePrompt('weather in Tokyo', catalog);
    expect(p).toContain('hackernews top');
    expect(p).toContain('weather now');
    expect(p).toContain('weather in Tokyo');
  });
});

describe('validateRoute', () => {
  it('accepts a real command and normalizes args', () => {
    expect(validateRoute({ site: 'weather', command: 'now', args: ['Tokyo'] }, catalog)).toEqual({
      site: 'weather',
      command: 'now',
      args: ['Tokyo'],
    });
  });

  it('defaults missing args to an empty array', () => {
    expect(validateRoute({ site: 'hackernews', command: 'top' }, catalog).args).toEqual([]);
  });

  it('coerces non-string args', () => {
    expect(validateRoute({ site: 'weather', command: 'now', args: [123] }, catalog).args).toEqual(['123']);
  });

  it('rejects an invented command', () => {
    expect(() => validateRoute({ site: 'weather', command: 'forecast' }, catalog)).toThrow(/no command matches/);
  });

  it('rejects a malformed response', () => {
    expect(() => validateRoute(null, catalog)).toThrow(/could not understand/);
    expect(() => validateRoute({ site: 'weather' }, catalog)).toThrow(/could not understand/);
  });
});

describe('route', () => {
  it('routes a query through the LLM and validates the result', async () => {
    const r = await route(fakeLLM({ site: 'github', command: 'search', args: ['rust cli'] }), 'find rust cli repos', catalog);
    expect(r).toEqual({ site: 'github', command: 'search', args: ['rust cli'] });
  });

  it('propagates validation errors for hallucinated routes', async () => {
    await expect(route(fakeLLM({ site: 'nope', command: 'nope' }), 'x', catalog)).rejects.toThrow(/no command matches/);
  });
});
