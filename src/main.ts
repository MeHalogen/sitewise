#!/usr/bin/env node
/** sitewise — control the web from your terminal. */
import { Command } from 'commander';
import pc from 'picocolors';
import type { Adapter, AdapterCommand } from './adapter.js';
import {
  browserClick,
  browserEval,
  browserFill,
  browserGoto,
  browserHtml,
  browserRead,
  browserScreenshot,
  browserStart,
  browserTabs,
  browserText,
  type BrowserOpts,
} from './browser/commands.js';
import { renderDoctor, runDoctor } from './doctor.js';
import { render } from './output.js';
import { readUrl } from './read.js';
import { adapters, listCommands } from './registry.js';

const VERSION = '1.0.0';

const program = new Command('sitewise')
  .description('Control the web from your terminal — sites as commands, browser automation, MCP for agents.')
  .version(VERSION)
  .option('-j, --json', 'output machine-readable JSON')
  .showHelpAfterError();

function wantJson(): boolean {
  return Boolean(program.opts().json) || !process.stdout.isTTY;
}

function output(result: { data: unknown; table?: never; text?: string } | Parameters<typeof render>[0]): void {
  console.log(render(result, wantJson()));
}

function fail(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(pc.red('error:') + ' ' + message);
  process.exit(1);
}

function registerAdapterCommand(parent: Command, cmd: AdapterCommand): void {
  const sub = parent.command(cmd.name).description(cmd.description);
  for (const arg of cmd.args ?? []) sub.argument(arg.name, arg.description);
  for (const opt of cmd.options ?? []) sub.option(opt.flags, opt.description, opt.default as string | undefined);
  sub.action(async (...invocation) => {
    // commander passes (args..., options, command)
    const args = invocation.slice(0, -2).map(String);
    const opts = invocation[invocation.length - 2] as Record<string, unknown>;
    try {
      output(await cmd.run({ args, opts }));
    } catch (err) {
      fail(err);
    }
  });
}

for (const adapter of adapters satisfies Adapter[]) {
  const group = program.command(adapter.name).description(adapter.description);
  for (const cmd of adapter.commands) registerAdapterCommand(group, cmd);
}

program
  .command('list')
  .description('List every available command')
  .action(() => {
    const rows = listCommands();
    output({
      data: rows,
      table: {
        columns: [
          { key: 'site', header: 'Site' },
          { key: 'mode', header: 'Mode' },
          { key: 'command', header: 'Command' },
          { key: 'description', header: 'Description', maxWidth: 70 },
        ],
        rows,
      },
    });
  });

program
  .command('read')
  .description('Fetch a URL and print the main article as clean Markdown')
  .argument('<url>', 'page URL')
  .action(async (url: string) => {
    try {
      const article = await readUrl(url);
      if (wantJson()) {
        output({ data: article });
      } else {
        const parts = [`# ${article.title}`, article.byline ? `_${article.byline}_` : '', '', article.markdown];
        console.log(parts.filter(Boolean).join('\n'));
      }
    } catch (err) {
      fail(err);
    }
  });

program
  .command('doctor')
  .description('Check that sitewise is healthy (node, network, browser)')
  .action(async () => {
    const result = await runDoctor();
    if (wantJson()) output({ data: result });
    else console.log(renderDoctor(result));
    if (!result.healthy) process.exitCode = 1;
  });

program
  .command('mcp')
  .description('Run sitewise as an MCP server over stdio (for Claude Code, Cursor, and other agents)')
  .action(async () => {
    const { runMcpServer } = await import('./mcp/server.js');
    await runMcpServer(VERSION);
  });

const browser = program
  .command('browser')
  .description('Control a Chrome-family browser via DevTools protocol')
  .option('-p, --port <n>', 'CDP port', '9222')
  .option('-t, --tab <which>', 'tab to target: 0-based index or URL/title substring');

function browserOpts(): BrowserOpts {
  const o = browser.opts();
  return { port: Number(o.port), tab: o.tab as string | undefined };
}

const browserAction =
  (fn: () => Promise<Parameters<typeof render>[0]>) =>
  async (): Promise<void> => {
    try {
      output(await fn());
    } catch (err) {
      fail(err);
    }
  };

browser
  .command('start')
  .description('Launch a sitewise-managed Chrome (dedicated profile, sessions persist)')
  .action(browserAction(() => browserStart(Number(browser.opts().port))));
browser.command('tabs').description('List open tabs').action(browserAction(() => browserTabs(browserOpts())));
browser
  .command('goto')
  .description('Navigate to a URL')
  .argument('<url>')
  .action((url: string) => browserAction(() => browserGoto(url, browserOpts()))());
browser
  .command('text')
  .description('Visible text of the page (or a selector)')
  .argument('[selector]')
  .action((selector?: string) => browserAction(() => browserText(selector, browserOpts()))());
browser
  .command('html')
  .description('HTML of the page (or a selector)')
  .argument('[selector]')
  .action((selector?: string) => browserAction(() => browserHtml(selector, browserOpts()))());
browser
  .command('read')
  .description('Extract the current page as Markdown')
  .action(browserAction(() => browserRead(browserOpts())));
browser
  .command('click')
  .description('Click the first element matching a CSS selector')
  .argument('<selector>')
  .action((selector: string) => browserAction(() => browserClick(selector, browserOpts()))());
browser
  .command('fill')
  .description('Fill an input matching a CSS selector')
  .argument('<selector>')
  .argument('<value>')
  .action((selector: string, value: string) => browserAction(() => browserFill(selector, value, browserOpts()))());
browser
  .command('eval')
  .description('Evaluate JavaScript in the page')
  .argument('<expression>')
  .action((expression: string) => browserAction(() => browserEval(expression, browserOpts()))());
browser
  .command('screenshot')
  .description('Capture the page as PNG')
  .option('-o, --out <file>', 'output file', 'screenshot.png')
  .action((opts: { out: string }) => browserAction(() => browserScreenshot(opts.out, browserOpts()))());

program.parseAsync(process.argv).catch(fail);
