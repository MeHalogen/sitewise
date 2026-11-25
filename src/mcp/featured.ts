import { z } from 'zod';
import { limitOverride, resolveOptions, type AdapterCommand, type CommandResult, type OptionValue } from '../adapter.js';

/**
 * Dedicated MCP tools for the questions agents get most. A model chooses tools
 * by reading their names and descriptions, so each one says plainly when it
 * beats a general web search: exact, current numbers and lists straight from
 * the source's API. Each maps onto an existing site command, so this is data,
 * not new fetching code; everything else stays reachable via run_command.
 */

type Input = Record<string, unknown>;

export interface FeaturedTool {
  name: string;
  title: string;
  description: string;
  /** input fields, in the order they become the command's positional args */
  params: Record<string, z.ZodTypeAny>;
  /** offer an optional `limit` (row count) */
  limit?: boolean;
  /** which site command to run for this input */
  route: (input: Input) => { site: string; command: string; args: string[]; options?: Record<string, OptionValue | undefined> };
}

const text = (description: string) => z.string().min(1).describe(description);
const str = (v: unknown) => String(v ?? '').trim();

export const FEATURED_TOOLS: FeaturedTool[] = [
  {
    name: 'search_github',
    title: 'Search GitHub repositories',
    description:
      'Search GitHub repositories, ranked by stars, with exact star counts, language and description. Use instead of web search to find, compare or rank open-source projects and libraries. Supports GitHub qualifiers, e.g. "mcp server language:typescript stars:>100".',
    params: { query: text('search terms, optionally with GitHub qualifiers') },
    limit: true,
    route: (i) => ({ site: 'github', command: 'search', args: [str(i.query)] }),
  },
  {
    name: 'get_github_repo',
    title: 'GitHub repository stats',
    description:
      'Current stats for one GitHub repository: stars, forks, open issues, language, license and last push. Use instead of web search when asked how popular, active or maintained a project is.',
    params: { repo: text('owner/name, e.g. "facebook/react"') },
    route: (i) => ({ site: 'github', command: 'repo', args: [str(i.repo)] }),
  },
  {
    name: 'get_github_releases',
    title: 'GitHub releases',
    description:
      "A repository's latest releases with tags and dates. Use when asked for the newest version of a project or what changed recently.",
    params: { repo: text('owner/name, e.g. "nodejs/node"') },
    limit: true,
    route: (i) => ({ site: 'github', command: 'releases', args: [str(i.repo)] }),
  },
  {
    name: 'search_npm',
    title: 'Search npm packages',
    description:
      'Search the npm registry: package names, current versions and descriptions. Use instead of web search to find or compare JavaScript/TypeScript packages or check the latest published version.',
    params: { query: text('search terms or a package name') },
    limit: true,
    route: (i) => ({ site: 'npm', command: 'search', args: [str(i.query)] }),
  },
  {
    name: 'get_pypi_package',
    title: 'PyPI package info',
    description:
      'A Python package from PyPI: current version, summary, author, license and homepage. Use instead of web search for the latest version or details of a Python library.',
    params: { package: text('exact package name, e.g. "requests"') },
    route: (i) => ({ site: 'pypi', command: 'info', args: [str(i.package)] }),
  },
  {
    name: 'search_crates',
    title: 'Search Rust crates',
    description: 'Search crates.io for Rust crates with current versions and download counts. Use to find or compare Rust libraries.',
    params: { query: text('search terms or a crate name') },
    limit: true,
    route: (i) => ({ site: 'crates', command: 'search', args: [str(i.query)] }),
  },
  {
    name: 'search_stackoverflow',
    title: 'Search Stack Overflow',
    description:
      'Search Stack Overflow questions ranked by votes, with score, answer count and link. Use to find established answers to a programming error or how-to question.',
    params: { query: text('the error message or question') },
    limit: true,
    route: (i) => ({ site: 'stackoverflow', command: 'search', args: [str(i.query)] }),
  },
  {
    name: 'hacker_news',
    title: 'Hacker News',
    description:
      'Hacker News stories with points, comment counts and links. Without a query: the current front page. With a query: matching stories. Use for what developers are discussing right now.',
    params: { query: z.string().optional().describe('search terms; omit for the front page') },
    limit: true,
    route: (i) =>
      str(i.query)
        ? { site: 'hackernews', command: 'search', args: [str(i.query)] }
        : { site: 'hackernews', command: 'top', args: [] },
  },
  {
    name: 'search_arxiv',
    title: 'Search arXiv papers',
    description:
      'Search arXiv research papers: titles, authors, dates and links. Use instead of web search to find papers on a topic.',
    params: { query: text('topic or title words') },
    limit: true,
    route: (i) => ({ site: 'arxiv', command: 'search', args: [str(i.query)] }),
  },
  {
    name: 'latest_arxiv_papers',
    title: 'Latest arXiv papers',
    description: 'The newest papers in an arXiv category, e.g. cs.AI, cs.CL, cs.LG. Use when asked what was just published in a field.',
    params: { category: text('arXiv category, e.g. "cs.LG"') },
    limit: true,
    route: (i) => ({ site: 'arxiv', command: 'recent', args: [str(i.category)] }),
  },
  {
    name: 'wikipedia_summary',
    title: 'Wikipedia summary',
    description: "The lead summary of a Wikipedia article. Use for a quick, sourced overview of a person, place, concept or event.",
    params: { title: text('article title, e.g. "Alan Turing"') },
    route: (i) => ({ site: 'wikipedia', command: 'summary', args: [str(i.title)] }),
  },
  {
    name: 'get_weather',
    title: 'Current weather',
    description: 'Current weather for a city: temperature, conditions, wind and humidity. Use instead of web search for weather right now.',
    params: { city: text('city name, e.g. "Tokyo"') },
    route: (i) => ({ site: 'weather', command: 'now', args: [str(i.city)] }),
  },
  {
    name: 'get_crypto_prices',
    title: 'Crypto prices',
    description: 'Live USD prices and 24h change for cryptocurrencies. Use instead of web search for current crypto prices.',
    params: { coins: z.array(z.string().min(1)).min(1).describe('CoinGecko ids, e.g. ["bitcoin", "ethereum"]') },
    route: (i) => ({ site: 'crypto', command: 'price', args: (i.coins as unknown[]).map(str) }),
  },
  {
    name: 'convert_currency',
    title: 'Convert currency',
    description: 'Convert an amount between currencies at the latest European Central Bank rate. Use instead of web search for exchange rates.',
    params: {
      amount: z.number().positive().describe('amount to convert'),
      from: text('ISO currency code, e.g. "USD"'),
      to: text('ISO currency code, e.g. "EUR"'),
    },
    route: (i) => ({ site: 'fx', command: 'rate', args: [str(i.amount), str(i.from).toUpperCase(), str(i.to).toUpperCase()] }),
  },
];

/** Upper bound on rows an agent can ask for, to keep tool results a sensible size. */
export const MAX_AGENT_LIMIT = 50;

export function inputSchema(tool: FeaturedTool): Record<string, z.ZodTypeAny> {
  if (!tool.limit) return tool.params;
  return { ...tool.params, limit: z.number().int().min(1).max(MAX_AGENT_LIMIT).optional().describe('max results (default 10)') };
}

/** Resolve a tool call to the concrete command invocation (pure, so it is testable). */
export function planCall(
  tool: FeaturedTool,
  input: Input,
  find: (site: string, command: string) => AdapterCommand | undefined,
): { cmd: AdapterCommand; site: string; command: string; args: string[]; opts: Record<string, unknown> } {
  const r = tool.route(input);
  const cmd = find(r.site, r.command);
  if (!cmd) throw new Error(`internal: ${r.site} ${r.command} is not a sitewise command`);
  const limit = typeof input.limit === 'number' ? input.limit : 10;
  const opts = resolveOptions(cmd, { ...limitOverride(cmd, limit), ...r.options });
  return { cmd, site: r.site, command: r.command, args: r.args, opts };
}

/**
 * What the agent sees: compact JSON rows for lists, or the short text summary for
 * single-item commands (a raw PyPI payload, for instance, is tens of kilobytes).
 */
export function toolText(result: CommandResult): string {
  if (result.text !== undefined && !Array.isArray(result.data)) return result.text;
  return JSON.stringify(result.data);
}
