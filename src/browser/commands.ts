import { writeFileSync } from 'node:fs';
import type { CommandResult } from '../adapter.js';
import { htmlToArticle } from '../read.js';
import { CdpSession, DEFAULT_CDP_PORT, evaluate, listTargets, type CdpTarget } from './cdp.js';
import { launchChrome } from './chrome.js';

export interface BrowserOpts {
  port?: number;
  /** substring match on tab URL/title, or a 0-based index */
  tab?: string;
}

async function pickTarget(opts: BrowserOpts): Promise<CdpTarget> {
  const port = opts.port ?? DEFAULT_CDP_PORT;
  const pages = (await listTargets(port)).filter((t) => t.type === 'page');
  if (pages.length === 0) throw new Error('No open tabs found.');
  if (opts.tab === undefined) return pages[0];
  if (/^\d+$/.test(opts.tab)) {
    const idx = Number(opts.tab);
    if (idx >= pages.length) throw new Error(`Tab index ${idx} out of range (${pages.length} tabs).`);
    return pages[idx];
  }
  const needle = opts.tab.toLowerCase();
  const hit = pages.find((p) => p.url.toLowerCase().includes(needle) || p.title.toLowerCase().includes(needle));
  if (!hit) throw new Error(`No tab matching "${opts.tab}".`);
  return hit;
}

async function withSession<T>(opts: BrowserOpts, fn: (s: CdpSession) => Promise<T>): Promise<T> {
  const target = await pickTarget(opts);
  if (!target.webSocketDebuggerUrl) throw new Error('Target has no debugger URL (is another client attached?).');
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);
  try {
    return await fn(session);
  } finally {
    session.close();
  }
}

const esc = (s: string) => JSON.stringify(s);

export async function browserStart(port?: number): Promise<CommandResult> {
  const res = await launchChrome(port ?? DEFAULT_CDP_PORT);
  const text = res.alreadyRunning
    ? 'Browser already running with CDP enabled.'
    : `Launched ${res.binary} with a dedicated sitewise profile. Log in to sites there; sessions persist.`;
  return { data: res, text };
}

export async function browserTabs(opts: BrowserOpts): Promise<CommandResult> {
  const pages = (await listTargets(opts.port ?? DEFAULT_CDP_PORT)).filter((t) => t.type === 'page');
  const rows = pages.map((p, i) => ({ index: i, title: p.title, url: p.url }));
  return {
    data: rows,
    table: {
      columns: [
        { key: 'index', header: '#', align: 'right' },
        { key: 'title', header: 'Title', maxWidth: 45 },
        { key: 'url', header: 'URL', maxWidth: 70 },
      ],
      rows,
    },
  };
}

export async function browserGoto(url: string, opts: BrowserOpts): Promise<CommandResult> {
  const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  return withSession(opts, async (s) => {
    await s.send('Page.enable');
    const loaded = s.waitForEvent('Page.loadEventFired', 20_000);
    await s.send('Page.navigate', { url: full });
    await loaded.catch(() => {}); // slow pages still usually render enough
    const title = await evaluate<string>(s, 'document.title');
    return { data: { url: full, title }, text: `Loaded: ${title || full}` };
  });
}

export async function browserText(selector: string | undefined, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    const expr = selector
      ? `(() => { const el = document.querySelector(${esc(selector)}); if (!el) throw new Error('No element matches ${selector}'); return el.innerText; })()`
      : 'document.body.innerText';
    const text = await evaluate<string>(s, expr);
    return { data: { text }, text };
  });
}

export async function browserHtml(selector: string | undefined, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    const expr = selector
      ? `(() => { const el = document.querySelector(${esc(selector)}); if (!el) throw new Error('No element matches ${selector}'); return el.outerHTML; })()`
      : 'document.documentElement.outerHTML';
    const html = await evaluate<string>(s, expr);
    return { data: { html }, text: html };
  });
}

export async function browserRead(opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    const html = await evaluate<string>(s, 'document.documentElement.outerHTML');
    const url = await evaluate<string>(s, 'location.href');
    const article = htmlToArticle(html, url);
    const text = [`# ${article.title}`, article.byline ? `_${article.byline}_` : '', '', article.markdown]
      .filter(Boolean)
      .join('\n');
    return { data: article, text };
  });
}

export async function browserClick(selector: string, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    const result = await evaluate<string>(
      s,
      `(() => {
        const el = document.querySelector(${esc(selector)});
        if (!el) throw new Error('No element matches ${selector}');
        el.scrollIntoView({ block: 'center' });
        el.click();
        return el.tagName.toLowerCase() + (el.textContent ? ': ' + el.textContent.trim().slice(0, 80) : '');
      })()`,
    );
    return { data: { clicked: selector, element: result }, text: `Clicked ${result}` };
  });
}

export async function browserFill(selector: string, value: string, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    await evaluate(
      s,
      `(() => {
        const el = document.querySelector(${esc(selector)});
        if (!el) throw new Error('No element matches ${selector}');
        el.focus();
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, ${esc(value)}); else el.value = ${esc(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
    );
    return { data: { filled: selector }, text: `Filled ${selector}` };
  });
}

export async function browserEval(expression: string, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    const value = await evaluate(s, expression);
    return { data: { value }, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) };
  });
}

export async function browserScreenshot(outFile: string, opts: BrowserOpts): Promise<CommandResult> {
  return withSession(opts, async (s) => {
    await s.send('Page.enable');
    const res = await s.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    writeFileSync(outFile, Buffer.from(res.data, 'base64'));
    return { data: { file: outFile }, text: `Saved screenshot to ${outFile}` };
  });
}
