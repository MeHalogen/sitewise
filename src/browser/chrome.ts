import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { DEFAULT_CDP_PORT, isBrowserRunning } from './cdp.js';

const MAC_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

const LINUX_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

const WIN_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export function findChrome(): string | null {
  const candidates =
    process.platform === 'darwin' ? MAC_CANDIDATES : process.platform === 'win32' ? WIN_CANDIDATES : LINUX_CANDIDATES;
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function profileDir(): string {
  return path.join(homedir(), '.webctl', 'browser-profile');
}

/**
 * Launch a webctl-managed Chrome with CDP enabled on the given port.
 * Uses a dedicated profile under ~/.webctl so it never touches the user's main profile;
 * log in to sites there once and sessions persist across runs.
 */
export async function launchChrome(port = DEFAULT_CDP_PORT): Promise<{ alreadyRunning: boolean; binary?: string }> {
  if (await isBrowserRunning(port)) return { alreadyRunning: true };

  const binary = findChrome();
  if (!binary) {
    throw new Error('No Chrome/Chromium/Brave/Edge binary found. Install one or use `webctl browser attach --port`.');
  }

  const child = spawn(
    binary,
    [`--remote-debugging-port=${port}`, `--user-data-dir=${profileDir()}`, '--no-first-run', '--no-default-browser-check'],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  // Poll until the CDP endpoint answers.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isBrowserRunning(port)) return { alreadyRunning: false, binary };
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Chrome started but the CDP endpoint on port ${port} never came up.`);
}
