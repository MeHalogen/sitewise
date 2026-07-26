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
  console.log(`${pc.bold(pc.yellow('▲ ' + title))} ${message}`);
}
