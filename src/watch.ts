import type { WatchSpec, WatchState } from './config.js';
import { loadConfig, loadWatchState, saveWatchState } from './config.js';
import { notify, postWebhook } from './notify.js';
import { limitOverride, resolveOptions } from './adapter.js';
import { findCommand } from './registry.js';

/**
 * Watch engine. Two modes per watch:
 *  - threshold: `--field price --below 60000` → notify when the first row's
 *    numeric field crosses INTO the zone (edge-triggered, no repeat spam)
 *  - change (default): notify when the identity of the first row changes
 *    (i.e. a new top item appeared). First run only sets the baseline.
 */

export interface Evaluation {
  triggered: boolean;
  message: string;
  state: WatchState[string];
}

const KEY_FIELDS = ['id', 'url', 'title', 'name', 'word', 'tag'];

/** Stable identity for "the first row changed" detection. */
export function rowKey(row: Record<string, unknown>): string {
  for (const f of KEY_FIELDS) {
    const v = row[f];
    if (typeof v === 'string' && v.length > 0) return `${f}:${v}`;
  }
  return JSON.stringify(row);
}

function headline(row: Record<string, unknown>): string {
  for (const f of ['title', 'name', 'word', 'content']) {
    const v = row[f];
    if (typeof v === 'string' && v.length > 0) return v.slice(0, 120);
  }
  const first = Object.values(row).find((v) => typeof v === 'string' && v.length > 0);
  return String(first ?? '').slice(0, 120);
}

export function evaluateWatch(
  watch: WatchSpec,
  rows: Record<string, unknown>[],
  prev: WatchState[string] = {},
): Evaluation {
  const now = Date.now();
  if (rows.length === 0) return { triggered: false, message: 'no data', state: { ...prev, lastRunAt: now } };
  const first = rows[0];

  // Threshold mode
  if (watch.field && (watch.below !== undefined || watch.above !== undefined)) {
    const raw = first[watch.field];
    const cleaned = String(raw ?? '').replace(/[^0-9.eE+-]/g, '');
    const value = typeof raw === 'number' ? raw : cleaned === '' ? NaN : Number(cleaned);
    if (!Number.isFinite(value)) {
      return { triggered: false, message: `field "${watch.field}" is not numeric`, state: { ...prev, lastRunAt: now } };
    }
    const inZone =
      (watch.below === undefined || value < watch.below) && (watch.above === undefined || value > watch.above);
    const triggered = inZone && prev.inZone !== true; // edge-triggered
    const bounds = [
      watch.below !== undefined ? `< ${watch.below}` : '',
      watch.above !== undefined ? `> ${watch.above}` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    return {
      triggered,
      message: `${watch.field} = ${value} (${inZone ? 'hit' : 'waiting for'} ${bounds})`,
      state: { ...prev, inZone, lastRunAt: now },
    };
  }

  // Change mode
  const key = rowKey(first);
  const isFirstRun = prev.lastKey === undefined;
  const triggered = !isFirstRun && key !== prev.lastKey;
  return {
    triggered,
    message: isFirstRun ? `baseline: ${headline(first)}` : triggered ? `new: ${headline(first)}` : 'no change',
    state: { ...prev, lastKey: key, lastRunAt: now },
  };
}

export function parseEvery(every: string | undefined, fallbackMs: number): number {
  if (!every) return fallbackMs;
  const m = /^(\d+)\s*(s|m|h)$/i.exec(every.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 's' ? n * 1000 : m[2].toLowerCase() === 'm' ? n * 60_000 : n * 3_600_000;
}

export function watchLabel(w: WatchSpec): string {
  return w.note ?? [w.site, w.command, ...(w.args ?? [])].join(' ');
}

/** Run every due watch once; notify on triggers. Returns a summary line per watch. */
export async function runWatchesOnce(opts: { force?: boolean; defaultEveryMs?: number } = {}): Promise<string[]> {
  const { watches } = loadConfig();
  const state = loadWatchState();
  const lines: string[] = [];
  const defaultEvery = opts.defaultEveryMs ?? 0;

  for (const w of watches) {
    const prev = state[w.id] ?? {};
    const due = opts.force || !prev.lastRunAt || Date.now() - prev.lastRunAt >= parseEvery(w.every, defaultEvery);
    if (!due) {
      lines.push(`${w.id}: not due`);
      continue;
    }
    const cmd = findCommand(w.site, w.command);
    if (!cmd) {
      lines.push(`${w.id}: unknown command ${w.site}/${w.command}`);
      continue;
    }
    try {
      const result = await cmd.run({ args: w.args ?? [], opts: resolveOptions(cmd, limitOverride(cmd, 5)) });
      const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
      const evaluation = evaluateWatch(w, rows, prev);
      state[w.id] = evaluation.state;
      if (evaluation.triggered) {
        notify(watchLabel(w), evaluation.message);
        if (w.webhook) await postWebhook(w.webhook, watchLabel(w), evaluation.message);
      }
      lines.push(`${w.id}: ${evaluation.message}`);
    } catch (err) {
      lines.push(`${w.id}: error — ${(err as Error).message}`);
    }
  }
  saveWatchState(state);
  return lines;
}
