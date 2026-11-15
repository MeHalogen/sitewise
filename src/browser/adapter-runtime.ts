import type { BrowserCommandSpec } from './declarative.js';
import { CdpSession, DEFAULT_CDP_PORT, evaluate, getBrowserWsUrl } from './cdp.js';
import { launchChrome } from './chrome.js';
import { BotWallError, looksLikeBotWall, pageTitle, visibleText } from './botwall.js';
import { extractRows } from './extract.js';

/** How long to wait for `waitFor` selectors on JS-rendered pages. */
const WAIT_SELECTOR_TIMEOUT_MS = 12_000;
const NAV_TIMEOUT_MS = 25_000;

async function pollForSelector(
  session: CdpSession,
  sessionId: string,
  selector: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const expr = `!!document.querySelector(${JSON.stringify(selector)})`;
  while (Date.now() < deadline) {
    if (await evaluate<boolean>(session, expr, sessionId)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for "${selector}" to appear.`);
}

export interface BrowserRunDetail {
  rows: Record<string, string>[];
  /** full page HTML — used by self-healing when rows come back empty */
  html: string;
}

/**
 * Drive the sitewise-managed browser through one declarative command:
 * open a throwaway tab, navigate, wait, extract rows (and capture HTML), then
 * close the tab. Reuses the persistent sitewise profile so logins apply.
 */
export async function runBrowserCommandDetailed(
  spec: BrowserCommandSpec,
  url: string,
  port = DEFAULT_CDP_PORT,
): Promise<BrowserRunDetail> {
  await launchChrome(port);
  const session = await CdpSession.connect(await getBrowserWsUrl(port));
  let targetId: string | undefined;
  try {
    const created = await session.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    targetId = created.targetId;
    const sessionId = await session.attachToTarget(targetId);

    await session.send('Page.enable', {}, sessionId);
    await session.send('Runtime.enable', {}, sessionId);
    const loaded = session.waitForEvent('Page.loadEventFired', NAV_TIMEOUT_MS, sessionId).catch(() => {});
    await session.send('Page.navigate', { url }, sessionId);
    await loaded;

    if (spec.waitFor) {
      // A stale waitFor selector shouldn't block healing — swallow the timeout.
      await pollForSelector(session, sessionId, spec.waitFor, WAIT_SELECTOR_TIMEOUT_MS).catch(() => {});
    }

    // Inject the shared extractor so tests (jsdom) and prod (page) run identical logic.
    const expr = `(${extractRows.toString()})(document, ${JSON.stringify(spec.list)})`;
    const rows = await evaluate<Record<string, string>[]>(session, expr, sessionId);
    const html = await evaluate<string>(session, 'document.documentElement.outerHTML', sessionId);
    if (rows.length === 0 && looksLikeBotWall(html)) {
      throw new BotWallError(new URL(url).host, pageTitle(html) || visibleText(html).slice(0, 60));
    }
    return { rows, html };
  } finally {
    if (targetId) await session.send('Target.closeTarget', { targetId }).catch(() => {});
    session.close();
  }
}
