import { optionKey, type Adapter, type AdapterCommand } from './adapter.js';
import { loadApiAdapter } from './api/declarative.js';
import { builtinApiAdapters } from './api/specs.js';
import { createHealingRunner } from './browser/autoheal.js';
import { loadBrowserAdapter, type BrowserAdapterSpec } from './browser/declarative.js';
import { arxiv } from './adapters/arxiv.js';
import { crypto } from './adapters/crypto.js';
import { github } from './adapters/github.js';
import { hackernews } from './adapters/hackernews.js';
import { rss } from './adapters/rss.js';
import { weather } from './adapters/weather.js';
import { builtinBrowserAdapters } from './adapters/web/specs.js';
import { loadUserAdapterSpecs } from './adapters/web/user-adapters.js';
import { wikipedia } from './adapters/wikipedia.js';

const codeAdapters: Adapter[] = [arxiv, crypto, github, hackernews, rss, weather, wikipedia];

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
  const apiAdapters = builtinApiAdapters.map(loadApiAdapter);
  // One runner per adapter, so an inline repair knows which adapter to save.
  const browserAdapters = [...browserSpecs().values()].map((spec) => loadBrowserAdapter(spec, createHealingRunner(spec)));
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

function modeLabel(a: Adapter): string {
  return `${a.mode ?? 'api'}${a.experimental ? ' (experimental)' : ''}`;
}

/** Flat listing of every command, for `sitewise list` and the MCP server. */
export function listCommands(): { site: string; mode: string; command: string; description: string }[] {
  return adapters.flatMap((a) =>
    a.commands.map((c) => ({ site: a.name, mode: modeLabel(a), command: c.name, description: c.description })),
  );
}

export interface CommandDescription {
  site: string;
  mode: string;
  command: string;
  description: string;
  args: { name: string; required: boolean; description: string }[];
  options: { name: string; description: string; default?: string | number | boolean }[];
  example?: string[];
}

/** Everything an agent needs to call a command correctly (MCP `list_commands`). */
export function describeCommands(): CommandDescription[] {
  return adapters.flatMap((a) =>
    a.commands.map((c) => ({
      site: a.name,
      mode: modeLabel(a),
      command: c.name,
      description: c.description,
      args: (c.args ?? []).map((arg) => ({
        name: arg.name.replace(/[<>[\]]/g, ''),
        required: arg.name.startsWith('<'),
        description: arg.description,
      })),
      options: (c.options ?? []).map((o) => ({ name: optionKey(o.flags), description: o.description, default: o.default })),
      ...(c.example ? { example: c.example } : {}),
    })),
  );
}
