import type { BrowserCommandSpec, BrowserRunner } from './declarative.js';
import { CdpSession, DEFAULT_CDP_PORT, evaluate, getBrowserWsUrl } from './cdp.js';
import { launchChrome } from './chrome.js';
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

/**
 * Drive the webctl-managed browser through one declarative command:
 * open a throwaway tab, navigate, wait, extract rows, and close the tab.
 * Reuses the persistent webctl profile so logged-in sessions apply.
 */
export function createBrowserRunner(port = DEFAULT_CDP_PORT): BrowserRunner {
  return async (spec: BrowserCommandSpec, url: string): Promise<Record<string, string>[]> => {
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

      if (spec.waitFor) await pollForSelector(session, sessionId, spec.waitFor, WAIT_SELECTOR_TIMEOUT_MS);

      // Inject the shared extractor so tests (jsdom) and prod (page) run identical logic.
      const expr = `(${extractRows.toString()})(document, ${JSON.stringify(spec.list)})`;
      return await evaluate<Record<string, string>[]>(session, expr, sessionId);
    } finally {
      if (targetId) await session.send('Target.closeTarget', { targetId }).catch(() => {});
      session.close();
    }
  };
}
