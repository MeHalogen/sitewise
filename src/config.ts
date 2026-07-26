import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Persistent user config: dashboard panels + watches. Lives in ~/.sitewise. */

export interface DashPanel {
  site: string;
  command: string;
  args?: string[];
  limit?: number;
  title?: string;
}

export interface WatchSpec {
  id: string;
  site: string;
  command: string;
  args?: string[];
  /** numeric threshold mode: watch this field on the first row */
  field?: string;
  below?: number;
  above?: number;
  /** re-run cadence like "5m", "1h"; daemon skips watches not yet due */
  every?: string;
  note?: string;
}

export interface Config {
  dash: DashPanel[];
  watches: WatchSpec[];
}

/** Per-watch runtime state (baselines, last values) — separate from config. */
export interface WatchState {
  [id: string]: {
    lastKey?: string;
    inZone?: boolean;
    lastRunAt?: number;
  };
}

export function configDir(): string {
  return process.env.SITEWISE_CONFIG_DIR ?? path.join(homedir(), '.sitewise');
}

const configPath = () => path.join(configDir(), 'config.json');
const statePath = () => path.join(configDir(), 'watch-state.json');

function readJson<T>(file: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function loadConfig(): Config {
  return readJson<Config>(configPath(), { dash: [], watches: [] });
}

export function saveConfig(config: Config): void {
  writeJson(configPath(), config);
}

export function loadWatchState(): WatchState {
  return readJson<WatchState>(statePath(), {});
}

export function saveWatchState(state: WatchState): void {
  writeJson(statePath(), state);
}
