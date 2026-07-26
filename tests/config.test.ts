import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, loadWatchState, saveConfig, saveWatchState } from '../src/config.js';
import { defaultPanels } from '../src/dash.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'sitewise-test-'));
  process.env.SITEWISE_CONFIG_DIR = dir;
});

afterAll(() => {
  delete process.env.SITEWISE_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('config store', () => {
  it('returns empty config when nothing saved', () => {
    expect(loadConfig()).toEqual({ dash: [], watches: [] });
  });

  it('round-trips config', () => {
    const config = { dash: defaultPanels('Tokyo'), watches: [{ id: 'x-1', site: 'crypto', command: 'top' }] };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.watches[0].id).toBe('x-1');
    expect(loaded.dash.some((p) => p.site === 'weather' && p.args?.[0] === 'Tokyo')).toBe(true);
  });

  it('round-trips watch state separately from config', () => {
    saveWatchState({ 'x-1': { lastKey: 'url:https://a', lastRunAt: 111 } });
    expect(loadWatchState()['x-1'].lastKey).toBe('url:https://a');
    expect(loadConfig().watches[0].id).toBe('x-1'); // untouched
  });
});

describe('defaultPanels', () => {
  it('has sane defaults without a city', () => {
    const panels = defaultPanels();
    expect(panels.length).toBeGreaterThanOrEqual(3);
    expect(panels.every((p) => p.site && p.command)).toBe(true);
    expect(panels.some((p) => p.site === 'weather')).toBe(false);
  });
});
