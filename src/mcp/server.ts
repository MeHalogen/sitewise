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
import { runBrowserCommandDetailed } from '../browser/adapter-runtime.js';
import { verifyAndBuild } from '../browser/author.js';
import { persistSpec } from '../browser/heal-store.js';
import { readUrl } from '../read.js';
import { describeCommands, findCommand } from '../registry.js';
import { limitOverride, resolveOptions, type CommandResult } from '../adapter.js';

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
    'List every available site command with its positional args, options (name, description, default) and an example. Call this first to discover what sitewise can do and how to call it.',
    {},
    async () => asText(JSON.stringify(describeCommands(), null, 2)),
  );

  server.tool(
    'run_command',
    'Run a sitewise site command, e.g. site="hackernews" command="top". Returns structured JSON.',
    {
      site: z.string().describe('adapter name, e.g. hackernews, reddit, github'),
      command: z.string().describe('command name, e.g. top, search'),
      args: z.array(z.string()).optional().describe('positional arguments, e.g. the search query'),
      limit: z.number().optional().describe('max results, when the command supports it (shorthand for options.limit)'),
      options: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('any of the command\'s options by name, e.g. {"time": "week"} for reddit top; see list_commands'),
    },
    async ({ site, command, args, limit, options }) => {
      const cmd = findCommand(site, command);
      if (!cmd) return asText(`Unknown command ${site}/${command}. Use list_commands to see what exists.`);
      let opts: Record<string, unknown>;
      try {
        opts = resolveOptions(cmd, { ...limitOverride(cmd, limit), ...options });
      } catch (err) {
        return asText(`Invalid options for ${site}/${command}: ${(err as Error).message}`);
      }
      try {
        return asContent(await cmd.run({ args: args ?? [], opts }));
      } catch (err) {
        return asText(`${site}/${command} failed: ${(err as Error).message}`);
      }
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

  server.tool(
    'author_adapter',
    'Create a new sitewise browser adapter for a site you have inspected. Provide the CSS selectors you found (use browser_goto + browser_text/browser_eval to inspect first). sitewise navigates the URL, VERIFIES your selectors extract data, and saves the adapter — so it appears in list_commands and works for everyone. Returns the extracted sample rows, or an error if the selectors matched nothing.',
    {
      site: z.string().describe('new adapter name, e.g. mysite'),
      command: z.string().describe('command name, e.g. list'),
      url: z.string().describe('page to scrape (may contain {query}/{0} placeholders)'),
      itemSelector: z.string().describe('CSS selector matching each repeated item/row'),
      fields: z
        .record(z.object({ selector: z.string().optional(), attr: z.string().optional(), absolute: z.boolean().optional() }))
        .describe('output field name -> how to read it: selector relative to the item (omit to use the item itself), attr for an attribute like href, absolute for absolute URLs'),
      description: z.string().optional(),
    },
    async ({ site, command, url, itemSelector, fields, description }) => {
      const req = { site, command, url, want: Object.keys(fields), description };
      const { html } = await runBrowserCommandDetailed(
        { name: command, description: '', url, list: { selector: itemSelector, fields } },
        url,
      );
      const result = verifyAndBuild(req, { selector: itemSelector, fields }, html);
      if (!result.ok) return asText(`Adapter not saved — ${result.reason}. Inspect the page and adjust your selectors.`);
      const file = persistSpec(result.spec!);
      return asText(
        `Saved adapter "${site} ${command}" to ${file}. It now appears in list_commands.\nSample rows:\n${JSON.stringify(result.rows.slice(0, 3), null, 2)}`,
      );
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
