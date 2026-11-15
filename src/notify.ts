import { execFile } from 'node:child_process';
import pc from 'picocolors';

/** AppleScript string literal. */
const appleString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** PowerShell single-quoted literal (no interpolation; ' is escaped by doubling). */
const psString = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** PowerShell's own app id, so toasts show without registering one for sitewise. */
const PS_APP_ID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';

/**
 * The program and arguments that show a desktop notification on this platform.
 * Arguments are passed directly (no shell), so text from the web — a headline,
 * a price — can never be run as a command.
 */
export function notificationCommand(
  platform: NodeJS.Platform,
  title: string,
  message: string,
): { file: string; args: string[] } | null {
  const t = title.slice(0, 200);
  const m = message.slice(0, 500);
  if (platform === 'darwin') {
    return { file: 'osascript', args: ['-e', `display notification ${appleString(m)} with title ${appleString(t)} sound name "Default"`] };
  }
  if (platform === 'linux') return { file: 'notify-send', args: ['--', t, m] };
  if (platform === 'win32') {
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      '$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
      `$x.GetElementsByTagName('text').Item(0).AppendChild($x.CreateTextNode(${psString(t)})) > $null`,
      `$x.GetElementsByTagName('text').Item(1).AppendChild($x.CreateTextNode(${psString(m)})) > $null`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(${psString(PS_APP_ID)}).Show([Windows.UI.Notifications.ToastNotification]::new($x))`,
    ].join('; ');
    return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script] };
  }
  return null;
}

/** Fire a desktop notification (macOS, Linux, Windows); always echoes to the terminal too. */
export function notify(title: string, message: string): void {
  const cmd = notificationCommand(process.platform, title, message);
  if (cmd) execFile(cmd.file, cmd.args, { windowsHide: true }, () => {});
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
