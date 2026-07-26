import type { Adapter, AdapterCommand } from './adapter.js';
import { loadApiAdapter } from './api/declarative.js';
import { builtinApiAdapters } from './api/specs.js';
import { createBrowserRunner } from './browser/adapter-runtime.js';
import { loadBrowserAdapter, type BrowserAdapterSpec } from './browser/declarative.js';
import { arxiv } from './adapters/arxiv.js';
import { crypto } from './adapters/crypto.js';
import { github } from './adapters/github.js';
import { hackernews } from './adapters/hackernews.js';
import { reddit } from './adapters/reddit.js';
import { rss } from './adapters/rss.js';
import { weather } from './adapters/weather.js';
import { builtinBrowserAdapters } from './adapters/web/specs.js';
import { loadUserAdapterSpecs } from './adapters/web/user-adapters.js';
import { wikipedia } from './adapters/wikipedia.js';

const codeAdapters: Adapter[] = [arxiv, crypto, github, hackernews, reddit, rss, weather, wikipedia];

/** Built-in specs merged with user overrides (~/.sitewise/adapters/*.yaml win by name). */
export function browserSpecs(): Map<string, BrowserAdapterSpec> {
  const byName = new Map<string, BrowserAdapterSpec>();
  for (const spec of builtinBrowserAdapters) byName.set(spec.name, spec);
  for (const spec of loadUserAdapterSpecs()) byName.set(spec.name, spec); // override wins
  return byName;
}

/** The current (possibly healed) spec for a browser adapter, by name. */
export function findBrowserSpec(name: string): BrowserAdapterSpec | undefined {
  return browserSpecs().get(name);
}

function buildAdapters(): Adapter[] {
  const runner = createBrowserRunner();
  const apiAdapters = builtinApiAdapters.map(loadApiAdapter);
  const browserAdapters = [...browserSpecs().values()].map((spec) => loadBrowserAdapter(spec, runner));
  return [...codeAdapters.map((a) => ({ ...a, mode: 'api' as const })), ...apiAdapters, ...browserAdapters].sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

export const adapters: Adapter[] = buildAdapters();

export function findAdapter(name: string): Adapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function findCommand(adapterName: string, commandName: string): AdapterCommand | undefined {
  return findAdapter(adapterName)?.commands.find((c) => c.name === commandName);
}

/** Flat listing of every command, for `sitewise list` and the MCP server. */
export function listCommands(): { site: string; mode: string; command: string; description: string }[] {
  return adapters.flatMap((a) =>
    a.commands.map((c) => ({ site: a.name, mode: a.mode ?? 'api', command: c.name, description: c.description })),
  );
}
