import { afterEach, describe, expect, it, vi } from 'vitest';
import { postWebhook } from '../src/notify.js';

afterEach(() => vi.unstubAllGlobals());

describe('postWebhook', () => {
  it('POSTs JSON with both text and content keys (Slack + Discord)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    const ok = await postWebhook('https://hooks.example/abc', 'bitcoin', 'price = 59000');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example/abc');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe('bitcoin: price = 59000');
    expect(body.content).toBe('bitcoin: price = 59000');
  });

  it('returns false and never throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(postWebhook('https://x', 't', 'm')).resolves.toBe(false);
  });

  it('returns false on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    expect(await postWebhook('https://x', 't', 'm')).toBe(false);
  });
});

describe('notificationCommand', async () => {
  const { notificationCommand } = await import('../src/notify.js');
  const hostile = 'BTC $(touch /tmp/pwned) `id` "quoted" it\'s';

  it('passes text as arguments, never through a shell (linux)', () => {
    expect(notificationCommand('linux', 'Alert', hostile)).toEqual({ file: 'notify-send', args: ['--', 'Alert', hostile] });
  });

  it('escapes AppleScript strings (macOS)', () => {
    const cmd = notificationCommand('darwin', 'T "x"', 'a\\b "c"')!;
    expect(cmd.file).toBe('osascript');
    expect(cmd.args[1]).toBe('display notification "a\\\\b \\"c\\"" with title "T \\"x\\"" sound name "Default"');
  });

  it('builds a PowerShell toast with single-quoted literals (Windows)', () => {
    const cmd = notificationCommand('win32', 'Price', hostile)!;
    expect(cmd.file).toBe('powershell.exe');
    const script = cmd.args.at(-1)!;
    expect(script).toContain("CreateTextNode('Price')");
    expect(script).toContain(`CreateTextNode('BTC $(touch /tmp/pwned) \`id\` "quoted" it''s')`);
    expect(script).toContain('ToastNotificationManager');
  });

  it('returns null on unsupported platforms', () => {
    expect(notificationCommand('aix', 't', 'm')).toBeNull();
  });
});
