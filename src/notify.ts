import { exec } from 'node:child_process';
import pc from 'picocolors';

/** Fire a desktop notification; falls back to a terminal bell + line. */
export function notify(title: string, message: string): void {
  const esc = (s: string) => s.replace(/["\\]/g, '');
  if (process.platform === 'darwin') {
    exec(
      `osascript -e 'display notification "${esc(message)}" with title "${esc(title)}" sound name "Default"'`,
      () => {},
    );
  } else if (process.platform === 'linux') {
    exec(`notify-send "${esc(title)}" "${esc(message)}"`, () => {});
  }
  // Always echo to the terminal too (daemon logs double as history).
  console.log(`${pc.bold(pc.yellow('> ' + title))} ${message}`);
}

/**
 * POST an alert to an incoming webhook. Sends both `text` (Slack) and
 * `content` (Discord) so the same URL works for either. Best-effort — a failing
 * webhook never breaks a watch run.
 */
export async function postWebhook(url: string, title: string, message: string): Promise<boolean> {
  const line = `${title}: ${message}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: line, content: line }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
