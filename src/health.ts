import { limitOverride, resolveOptions, type Adapter, type AdapterCommand, type CommandResult } from './adapter.js';
import { BotWallError } from './browser/botwall.js';
import { HttpError } from './http.js';
import { reportUrl } from './report.js';

/**
 * Adapter health: run every command's example and record whether it returned
 * data. Powers `sitewise doctor --adapters` and the nightly canary.
 */

/** `blocked`: the site showed a bot check, so this environment cannot judge it (not counted as broken). */
export type HealthStatus = 'ok' | 'empty' | 'fail' | 'blocked' | 'skipped';

export interface HealthResult {
  site: string;
  command: string;
  mode: 'api' | 'browser';
  args: string[];
  status: HealthStatus;
  ms: number;
  rows?: number;
  error?: string;
  report?: string;
  /** failed on the first (parallel) try, passed on the confirming retry */
  flaky?: boolean;
}

/** CI runners (GitHub sets CI=true) run on datacenter IPs that some sites refuse. */
export function onCi(): boolean {
  return /^(1|true)$/i.test(process.env.CI ?? '');
}

const DATACENTER_NOTE = 'refuses requests from cloud/CI IP addresses (works from home connections)';

export interface HealthOptions {
  /** include browser adapters (launches Chrome; use SITEWISE_HEADLESS=1 on servers) */
  browser?: boolean;
  /** only these sites */
  only?: string[];
  /** commands run at once (API adapters); browser commands always run one at a time */
  concurrency?: number;
}

function requiredArgs(cmd: AdapterCommand): number {
  return (cmd.args ?? []).filter((a) => a.name.startsWith('<')).length;
}

/** How many rows (or text characters) a result carries; 0 means it came back empty. */
export function resultSize(result: CommandResult): number {
  if (Array.isArray(result.data)) {
    return result.data.filter((r) => r && Object.values(r as object).some((v) => v !== '' && v != null)).length;
  }
  if (result.text !== undefined) return result.text.trim().length > 0 ? 1 : 0;
  return result.data ? 1 : 0;
}

export async function checkCommand(adapter: Adapter, cmd: AdapterCommand): Promise<HealthResult> {
  const mode = adapter.mode ?? 'api';
  const args = cmd.example ?? [];
  const base = { site: adapter.name, command: cmd.name, mode, args };
  if (args.length < requiredArgs(cmd)) {
    return { ...base, status: 'skipped', ms: 0, error: 'no example arguments' };
  }
  const started = Date.now();
  try {
    const result = await cmd.run({ args, opts: resolveOptions(cmd, limitOverride(cmd, 3)) });
    const rows = resultSize(result);
    if (rows === 0 && adapter.refusesDatacenters && onCi()) {
      return { ...base, status: 'blocked', ms: Date.now() - started, rows: 0, error: `${adapter.name} ${DATACENTER_NOTE}` };
    }
    return rows > 0
      ? { ...base, status: 'ok', ms: Date.now() - started, rows }
      : { ...base, status: 'empty', ms: Date.now() - started, rows: 0, error: 'returned no data', report: reportUrl(adapter.name, cmd.name, 'returned no data', args) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (err instanceof BotWallError) return { ...base, status: 'blocked', ms: Date.now() - started, error };
    const refused = err instanceof HttpError && (err.status === 401 || err.status === 403);
    if (refused && adapter.refusesDatacenters && onCi()) {
      return { ...base, status: 'blocked', ms: Date.now() - started, error: `${adapter.name} ${DATACENTER_NOTE}` };
    }
    return { ...base, status: 'fail', ms: Date.now() - started, error, report: reportUrl(adapter.name, cmd.name, error, args) };
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runHealth(adapters: Adapter[], opts: HealthOptions = {}): Promise<HealthResult[]> {
  const pairs = adapters
    .filter((a) => !opts.only?.length || opts.only.includes(a.name))
    // Experimental adapters need a logged-in session, which a health check never has.
    .filter((a) => (a.mode ?? 'api') === 'api' || (opts.browser && !a.experimental))
    .flatMap((a) => a.commands.map((c) => ({ a, c })));
  const api = pairs.filter((p) => (p.a.mode ?? 'api') === 'api');
  const browser = pairs.filter((p) => p.a.mode === 'browser');
  const all = [...api, ...browser];
  const results = [
    ...(await pool(api, opts.concurrency ?? 8, (p) => checkCommand(p.a, p.c))),
    ...(await pool(browser, 1, (p) => checkCommand(p.a, p.c))),
  ];
  // Confirm failures one at a time, so a rate limit hit by the parallel pass or a
  // one-off blip is not reported as a broken site.
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fail' || results[i].status === 'empty') {
      const retry = await checkCommand(all[i].a, all[i].c);
      results[i] = retry.status === 'ok' ? { ...retry, flaky: true } : retry;
    }
  }
  return results.sort((x, y) => x.site.localeCompare(y.site) || x.command.localeCompare(y.command));
}

export function summarize(results: HealthResult[]): { total: number; ok: number; broken: number; blocked: number; skipped: number } {
  const checked = results.filter((r) => r.status !== 'skipped' && r.status !== 'blocked');
  const ok = checked.filter((r) => r.status === 'ok').length;
  const blocked = results.filter((r) => r.status === 'blocked').length;
  return { total: checked.length, ok, broken: checked.length - ok, blocked, skipped: results.length - checked.length - blocked };
}

/** A shields.io endpoint badge: https://shields.io/badges/endpoint-badge */
export function badgeFor(results: HealthResult[]): { schemaVersion: 1; label: string; message: string; color: string } {
  const { total, ok } = summarize(results);
  const ratio = total ? ok / total : 0;
  return {
    schemaVersion: 1,
    label: 'adapters',
    message: `${ok}/${total} healthy`,
    color: ratio === 1 ? 'brightgreen' : ratio >= 0.9 ? 'yellow' : 'red',
  };
}
