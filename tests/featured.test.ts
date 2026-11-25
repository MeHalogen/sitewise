import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FEATURED_TOOLS, inputSchema, MAX_AGENT_LIMIT, planCall, toolText } from '../src/mcp/featured.js';
import { SERVER_INSTRUCTIONS } from '../src/mcp/server.js';
import { findCommand } from '../src/registry.js';

/** A realistic input for every tool; also used for the live check. */
export const SAMPLE_INPUT: Record<string, Record<string, unknown>> = {
  search_github: { query: 'mcp server' },
  get_github_repo: { repo: 'nodejs/node' },
  get_github_releases: { repo: 'nodejs/node' },
  search_npm: { query: 'react' },
  get_pypi_package: { package: 'requests' },
  search_crates: { query: 'serde' },
  search_stackoverflow: { query: 'async await' },
  hacker_news: {},
  search_arxiv: { query: 'diffusion models' },
  latest_arxiv_papers: { category: 'cs.LG' },
  wikipedia_summary: { title: 'Alan Turing' },
  get_weather: { city: 'London' },
  get_crypto_prices: { coins: ['bitcoin', 'ethereum'] },
  convert_currency: { amount: 100, from: 'usd', to: 'eur' },
};

describe('featured agent tools', () => {
  it('have unique, valid MCP names and a sample input each', () => {
    const names = FEATURED_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
    expect(Object.keys(SAMPLE_INPUT).sort()).toEqual([...names].sort());
  });

  it('say when to use them, in a description a model can act on', () => {
    for (const t of FEATURED_TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(60);
      expect(t.description.length, t.name).toBeLessThan(400);
      expect(t.description, t.name).toMatch(/\bUse\b/);
    }
  });

  it('route every sample input to a real command with all required args', () => {
    for (const t of FEATURED_TOOLS) {
      const input = z.object(inputSchema(t)).parse(SAMPLE_INPUT[t.name]);
      const call = planCall(t, input, findCommand);
      const required = (call.cmd.args ?? []).filter((a) => a.name.startsWith('<')).length;
      expect(call.args.length, t.name).toBeGreaterThanOrEqual(required);
      expect(call.args.every((a) => a.length > 0), t.name).toBe(true);
    }
  });

  it('pass limit through, default to 10, and cap it', () => {
    const npm = FEATURED_TOOLS.find((t) => t.name === 'search_npm')!;
    expect(planCall(npm, { query: 'x', limit: 25 }, findCommand).opts.limit).toBe(25);
    expect(planCall(npm, { query: 'x' }, findCommand).opts.limit).toBe(10);
    expect(() => z.object(inputSchema(npm)).parse({ query: 'x', limit: MAX_AGENT_LIMIT + 1 })).toThrow();
  });

  it('route hacker_news to the front page or a search', () => {
    const hn = FEATURED_TOOLS.find((t) => t.name === 'hacker_news')!;
    expect(planCall(hn, {}, findCommand).command).toBe('top');
    expect(planCall(hn, { query: 'rust' }, findCommand)).toMatchObject({ command: 'search', args: ['rust'] });
  });

  it('normalise currency codes', () => {
    const fx = FEATURED_TOOLS.find((t) => t.name === 'convert_currency')!;
    expect(planCall(fx, SAMPLE_INPUT.convert_currency, findCommand).args).toEqual(['100', 'USD', 'EUR']);
  });

  it('return the short summary for single items and compact JSON for lists', () => {
    expect(toolText({ data: { huge: 'payload' }, text: 'Version: 2.32' })).toBe('Version: 2.32');
    expect(toolText({ data: [{ a: 1 }], table: { columns: [], rows: [] } })).toBe('[{"a":1}]');
  });

  it('server instructions name tools that exist', () => {
    for (const name of SERVER_INSTRUCTIONS.match(/\b[a-z]+_[a-z_]+\b/g) ?? []) {
      if (name === 'browser_') continue;
      const known = FEATURED_TOOLS.some((t) => t.name === name) || ['list_commands', 'run_command', 'read_url'].includes(name);
      expect(known, name).toBe(true);
    }
  });
});
