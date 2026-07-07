import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  browserClick,
  browserEval,
  browserFill,
  browserGoto,
  browserRead,
  browserStart,
  browserTabs,
  browserText,
} from '../browser/commands.js';
import { readUrl } from '../read.js';
import { findCommand, listCommands } from '../registry.js';
import type { CommandResult } from '../adapter.js';

function asContent(result: CommandResult) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
}

function asText(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/** Run sitewise as an MCP server over stdio, exposing adapters + browser control as tools. */
export async function runMcpServer(version: string): Promise<void> {
  const server = new McpServer({ name: 'sitewise', version });

  server.tool(
    'list_commands',
    'List every available site command (site, command, description). Call this first to discover what sitewise can do.',
    {},
    async () => asText(JSON.stringify(listCommands(), null, 2)),
  );

  server.tool(
    'run_command',
    'Run a sitewise site command, e.g. site="hackernews" command="top". Returns structured JSON.',
    {
      site: z.string().describe('adapter name, e.g. hackernews, reddit, github'),
      command: z.string().describe('command name, e.g. top, search'),
      args: z.array(z.string()).optional().describe('positional arguments, e.g. the search query'),
      limit: z.number().optional().describe('max results, when the command supports it'),
    },
    async ({ site, command, args, limit }) => {
      const cmd = findCommand(site, command);
      if (!cmd) return asText(`Unknown command ${site}/${command}. Use list_commands to see what exists.`);
      const opts: Record<string, unknown> = {};
      for (const o of cmd.options ?? []) {
        if (o.default !== undefined) {
          const key = o.flags.match(/--([a-z-]+)/)?.[1] ?? '';
          opts[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = o.default;
        }
      }
      if (limit !== undefined) opts.limit = limit;
      return asContent(await cmd.run({ args: args ?? [], opts }));
    },
  );

  server.tool(
    'read_url',
    'Fetch a URL and return the main article as clean Markdown (title, byline, body).',
    { url: z.string().describe('the page URL') },
    async ({ url }) => {
      const article = await readUrl(url);
      return asText(`# ${article.title}\n\n${article.markdown}`);
    },
  );

  const tab = z.string().optional().describe('tab to target: 0-based index or URL/title substring; defaults to first tab');

  server.tool('browser_start', 'Launch (or confirm) the sitewise-managed Chrome with DevTools control enabled.', {}, async () =>
    asContent(await browserStart()),
  );
  server.tool('browser_tabs', 'List open browser tabs with their indexes.', {}, async () =>
    asContent(await browserTabs({})),
  );
  server.tool(
    'browser_goto',
    'Navigate a tab to a URL and wait for it to load.',
    { url: z.string(), tab },
    async ({ url, tab: t }) => asContent(await browserGoto(url, { tab: t })),
  );
  server.tool(
    'browser_text',
    'Get visible text of the page (or of a CSS selector).',
    { selector: z.string().optional(), tab },
    async ({ selector, tab: t }) => asContent(await browserText(selector, { tab: t })),
  );
  server.tool(
    'browser_read',
    'Extract the main article of the current page as Markdown.',
    { tab },
    async ({ tab: t }) => asContent(await browserRead({ tab: t })),
  );
  server.tool(
    'browser_click',
    'Click the first element matching a CSS selector.',
    { selector: z.string(), tab },
    async ({ selector, tab: t }) => asContent(await browserClick(selector, { tab: t })),
  );
  server.tool(
    'browser_fill',
    'Fill an input/textarea matching a CSS selector with a value (fires input/change events).',
    { selector: z.string(), value: z.string(), tab },
    async ({ selector, value, tab: t }) => asContent(await browserFill(selector, value, { tab: t })),
  );
  server.tool(
    'browser_eval',
    'Evaluate a JavaScript expression in the page and return its JSON-serialized value.',
    { expression: z.string(), tab },
    async ({ expression, tab: t }) => asContent(await browserEval(expression, { tab: t })),
  );

  await server.connect(new StdioServerTransport());
}
