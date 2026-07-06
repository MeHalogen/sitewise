import type { Adapter, AdapterCommand } from './adapter.js';
import { arxiv } from './adapters/arxiv.js';
import { crypto } from './adapters/crypto.js';
import { github } from './adapters/github.js';
import { hackernews } from './adapters/hackernews.js';
import { reddit } from './adapters/reddit.js';
import { rss } from './adapters/rss.js';
import { weather } from './adapters/weather.js';
import { wikipedia } from './adapters/wikipedia.js';

export const adapters: Adapter[] = [arxiv, crypto, github, hackernews, reddit, rss, weather, wikipedia];

export function findAdapter(name: string): Adapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function findCommand(adapterName: string, commandName: string): AdapterCommand | undefined {
  return findAdapter(adapterName)?.commands.find((c) => c.name === commandName);
}

/** Flat listing of every command, for `webctl list` and the MCP server. */
export function listCommands(): { site: string; command: string; description: string }[] {
  return adapters.flatMap((a) =>
    a.commands.map((c) => ({ site: a.name, command: c.name, description: c.description })),
  );
}
