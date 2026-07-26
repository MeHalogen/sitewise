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
import { route } from './ask.js';
import { runBrowserCommandDetailed } from './browser/adapter-runtime.js';
import { resolveUrl } from './browser/declarative.js';
import { countUsableRows, healAgainstHtml } from './browser/heal.js';
import { applyHeal, persistSpec } from './browser/heal-store.js';
import { loadConfig, saveConfig } from './config.js';
import { defaultPanels, panelLabel, renderDash } from './dash.js';
import { renderDoctor, runDoctor } from './doctor.js';
import { defaultLLM, llmAvailable } from './llm.js';
import { render } from './output.js';
import { readUrl } from './read.js';
import { adapters, findBrowserSpec, listCommands } from './registry.js';
import { parseEvery, runWatchesOnce, watchLabel } from './watch.js';

const VERSION = '1.1.0';

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

// ---- dash: your personal terminal briefing ----
const dash = program
  .command('dash')
  .description('Your personal dashboard — configured feeds in one command')
  .action(async () => {
    try {
      console.log(await renderDash());
    } catch (err) {
      fail(err);
    }
  });

dash
  .command('init')
  .description('Create a starter dashboard (HN, crypto, DEV; add weather with --city)')
  .option('-c, --city <city>', 'add a weather panel for this city')
  .action((opts: { city?: string }) => {
    const config = loadConfig();
    config.dash = defaultPanels(opts.city);
    saveConfig(config);
    console.log(`Dashboard created with ${config.dash.length} panels. Run ${pc.cyan('sitewise dash')} to see it.`);
  });

dash
  .command('add')
  .description('Add any site command as a dashboard panel')
  .argument('<site>', 'adapter name, e.g. reddit')
  .argument('<command>', 'command name, e.g. hot')
  .argument('[args...]', 'command arguments')
  .option('-l, --limit <n>', 'rows to show', '5')
  .option('--title <title>', 'panel title')
  .action((site: string, command: string, args: string[], opts: { limit: string; title?: string }) => {
    const config = loadConfig();
    config.dash.push({ site, command, args, limit: Number(opts.limit), title: opts.title });
    saveConfig(config);
    console.log(`Added panel #${config.dash.length}. Run ${pc.cyan('sitewise dash')}.`);
  });

dash
  .command('remove')
  .description('Remove a panel by number (see: dash list)')
  .argument('<n>', '1-based panel number')
  .action((n: string) => {
    const config = loadConfig();
    const idx = Number(n) - 1;
    if (idx < 0 || idx >= config.dash.length) fail(new Error(`no panel #${n}`));
    const [removed] = config.dash.splice(idx, 1);
    saveConfig(config);
    console.log(`Removed: ${panelLabel(removed)}`);
  });

dash
  .command('list')
  .description('List configured panels')
  .action(() => {
    const { dash: panels } = loadConfig();
    if (panels.length === 0) console.log('No panels. Try: sitewise dash init');
    panels.forEach((p, i) => console.log(`${i + 1}. ${panelLabel(p)}${p.limit ? pc.dim(`  (limit ${p.limit})`) : ''}`));
  });

// ---- watch: notify me when the web changes ----
const watch = program
  .command('watch')
  .description('Watch any command for changes or thresholds; get desktop notifications');

watch
  .command('add')
  .description('Watch a command (change detection by default; add --field + --below/--above for thresholds)')
  .argument('<site>', 'adapter name, e.g. crypto')
  .argument('<command>', 'command name, e.g. price')
  .argument('[args...]', 'command arguments')
  .option('--field <name>', 'numeric field on the first row to test')
  .option('--below <n>', 'trigger when field < n')
  .option('--above <n>', 'trigger when field > n')
  .option('--every <dur>', 'minimum re-check interval, e.g. 30s, 15m, 1h', '15m')
  .option('--note <text>', 'label used in notifications')
  .action(
    (
      site: string,
      command: string,
      args: string[],
      opts: { field?: string; below?: string; above?: string; every: string; note?: string },
    ) => {
      const config = loadConfig();
      const id = `${site}-${command}-${config.watches.length + 1}`;
      config.watches.push({
        id,
        site,
        command,
        args,
        field: opts.field,
        below: opts.below !== undefined ? Number(opts.below) : undefined,
        above: opts.above !== undefined ? Number(opts.above) : undefined,
        every: opts.every,
        note: opts.note,
      });
      saveConfig(config);
      console.log(
        `Watching ${pc.cyan(id)} every ${opts.every}. Check with ${pc.cyan('sitewise watch run')} or keep ${pc.cyan(
          'sitewise watch daemon',
        )} running.`,
      );
    },
  );

watch
  .command('list')
  .description('List watches')
  .action(() => {
    const { watches } = loadConfig();
    if (watches.length === 0) console.log('No watches. Try: sitewise watch add crypto price bitcoin --field price --below 60000');
    watches.forEach((w) => {
      const mode = w.field ? `${w.field} ${w.below !== undefined ? '< ' + w.below : ''}${w.above !== undefined ? ' > ' + w.above : ''}` : 'on change';
      console.log(`${pc.cyan(w.id)}  ${watchLabel(w)}  ${pc.dim(`[${mode}, every ${w.every ?? '15m'}]`)}`);
    });
  });

watch
  .command('remove')
  .description('Remove a watch by id')
  .argument('<id>')
  .action((id: string) => {
    const config = loadConfig();
    const before = config.watches.length;
    config.watches = config.watches.filter((w) => w.id !== id);
    if (config.watches.length === before) fail(new Error(`no watch with id ${id}`));
    saveConfig(config);
    console.log(`Removed ${id}`);
  });

watch
  .command('run')
  .description('Run all watches once (ideal for cron); notifies on triggers')
  .option('--force', 'ignore per-watch intervals and run everything now')
  .action(async (opts: { force?: boolean }) => {
    const lines = await runWatchesOnce({ force: opts.force ?? true });
    for (const line of lines) console.log(pc.dim(line));
  });

watch
  .command('daemon')
  .description('Keep running, checking due watches on an interval')
  .option('-i, --interval <dur>', 'tick interval, e.g. 60s, 5m', '5m')
  .action(async (opts: { interval: string }) => {
    const tick = parseEvery(opts.interval, 5 * 60_000);
    console.log(`sitewise watch daemon — ticking every ${opts.interval}. Ctrl-C to stop.`);
    // Run immediately, then on the interval; per-watch `every` gates re-runs.
    for (;;) {
      const lines = await runWatchesOnce({ defaultEveryMs: tick });
      for (const line of lines) console.log(pc.dim(`${new Date().toLocaleTimeString()}  ${line}`));
      await new Promise((r) => setTimeout(r, tick));
    }
  });

// ---- ask: natural language → the right command ----
program
  .command('ask')
  .description('Ask in plain English; sitewise routes it to the right command and runs it')
  .argument('<query...>', 'e.g. "top hacker news stories" or "weather in Tokyo"')
  .option('--dry-run', 'show the resolved command without running it')
  .action(async (queryParts: string[], opts: { dryRun?: boolean }) => {
    try {
      if (!llmAvailable()) {
        fail(new Error('`ask` needs an LLM. Set ANTHROPIC_API_KEY (optionally SITEWISE_LLM_MODEL), then retry.'));
      }
      const query = queryParts.join(' ');
      const chosen = await route(defaultLLM(), query, listCommands());
      const line = `sitewise ${chosen.site} ${chosen.command}${chosen.args.length ? ' ' + chosen.args.join(' ') : ''}`;
      if (opts.dryRun) {
        console.log(line);
        return;
      }
      console.error(pc.dim(`→ ${line}`));
      const cmd = findCommandOrFail(chosen.site, chosen.command);
      output(await cmd.run({ args: chosen.args, opts: {} }));
    } catch (err) {
      fail(err);
    }
  });

function findCommandOrFail(site: string, command: string): AdapterCommand {
  const adapter = adapters.find((a) => a.name === site);
  const cmd = adapter?.commands.find((c) => c.name === command);
  if (!cmd) fail(new Error(`Command ${site} ${command} not found.`));
  return cmd!;
}

// ---- heal: repair a browser adapter whose selectors broke ----
program
  .command('heal')
  .description('Self-heal a browser adapter: if it returns no data, an LLM proposes new selectors, verifies them, and saves the fix')
  .argument('<site>', 'browser adapter name, e.g. producthunt')
  .argument('<command>', 'command name, e.g. today')
  .argument('[args...]', 'command arguments (same as running it)')
  .option('--force', 'heal even if the current selectors still return data')
  .action(async (site: string, command: string, args: string[], opts: { force?: boolean }) => {
    try {
      if (!llmAvailable()) {
        fail(new Error('Healing needs an LLM. Set ANTHROPIC_API_KEY (optionally SITEWISE_LLM_MODEL), then retry.'));
      }
      const spec = findBrowserSpec(site);
      if (!spec) fail(new Error(`No browser adapter named "${site}". See: sitewise list`));
      const cmd = spec!.commands.find((c) => c.name === command);
      if (!cmd) fail(new Error(`Adapter "${site}" has no command "${command}".`));

      const url = resolveUrl(cmd!.url, args);
      console.log(pc.dim(`Loading ${url} …`));
      const { rows, html } = await runBrowserCommandDetailed(cmd!, url);

      if (countUsableRows(rows) > 0 && !opts.force) {
        console.log(pc.green(`✓ ${site} ${command} is healthy — ${countUsableRows(rows)} rows. Nothing to heal.`));
        return;
      }

      console.log(pc.yellow(`No data extracted — asking the model to repair selectors …`));
      const result = await healAgainstHtml(defaultLLM(), cmd!, html);
      if (!result.healed) {
        fail(new Error(`Could not heal automatically: ${result.reason}`));
      }
      const healedSpec = applyHeal(spec!, command, result.proposal!);
      const file = persistSpec(healedSpec);
      console.log(pc.green(`✓ Healed ${site} ${command} — now extracts ${countUsableRows(result.rows)} rows.`));
      console.log(pc.dim(`  new item selector: ${result.proposal!.selector}`));
      console.log(pc.dim(`  saved to ${file} (overrides the built-in; hand-edit or delete to revert)`));
    } catch (err) {
      fail(err);
    }
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
