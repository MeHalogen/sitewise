import type { Adapter, AdapterCommand } from './adapter.js';
import { createBrowserRunner } from './browser/adapter-runtime.js';
import { loadBrowserAdapter } from './browser/declarative.js';
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

const apiAdapters: Adapter[] = [arxiv, crypto, github, hackernews, reddit, rss, weather, wikipedia];

function buildAdapters(): Adapter[] {
  const runner = createBrowserRunner();
  const browserSpecs = [...builtinBrowserAdapters, ...loadUserAdapterSpecs()];
  const browserAdapters = browserSpecs.map((spec) => loadBrowserAdapter(spec, runner));
  // API adapters first (they need no browser), then browser adapters, all sorted by name.
  return [...apiAdapters.map((a) => ({ ...a, mode: 'api' as const })), ...browserAdapters].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export const adapters: Adapter[] = buildAdapters();

export function findAdapter(name: string): Adapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function findCommand(adapterName: string, commandName: string): AdapterCommand | undefined {
  return findAdapter(adapterName)?.commands.find((c) => c.name === commandName);
}

/** Flat listing of every command, for `webctl list` and the MCP server. */
export function listCommands(): { site: string; mode: string; command: string; description: string }[] {
  return adapters.flatMap((a) =>
    a.commands.map((c) => ({ site: a.name, mode: a.mode ?? 'api', command: c.name, description: c.description })),
  );
}
