import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { configDir } from './config.js';

/**
 * Lightweight local data trail. Opt-in (SITEWISE_HISTORY=1): every command run
 * appends its rows to a per-command JSONL file under ~/.sitewise/history, so
 * your lookups accumulate into a queryable personal dataset — no database, no
 * native deps (which would break `npm i -g`).
 */

export interface HistoryEntry {
  ts: string;
  site: string;
  command: string;
  args: string[];
  rows: unknown[];
}

export function historyEnabled(): boolean {
  return process.env.SITEWISE_HISTORY === '1';
}

function historyDir(): string {
  return path.join(configDir(), 'history');
}

function historyFile(site: string, command: string): string {
  return path.join(historyDir(), `${site}-${command}.jsonl`);
}

/** Append one run's rows. No-op unless the data is an array (list-style results). */
export function recordHistory(site: string, command: string, args: string[], data: unknown): void {
  if (!Array.isArray(data) || data.length === 0) return;
  const entry: HistoryEntry = { ts: new Date().toISOString(), site, command, args, rows: data };
  mkdirSync(historyDir(), { recursive: true });
  appendFileSync(historyFile(site, command), JSON.stringify(entry) + '\n');
}

/** Read recorded entries for a command, newest first, optionally text-filtered. */
export function readHistory(
  site: string,
  command: string,
  opts: { limit?: number; grep?: string } = {},
): HistoryEntry[] {
  let text: string;
  try {
    text = readFileSync(historyFile(site, command), 'utf8');
  } catch {
    return [];
  }
  let entries = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as HistoryEntry);
  if (opts.grep) {
    const needle = opts.grep.toLowerCase();
    entries = entries.filter((e) => JSON.stringify(e.rows).toLowerCase().includes(needle));
  }
  entries.reverse();
  return opts.limit ? entries.slice(0, opts.limit) : entries;
}
