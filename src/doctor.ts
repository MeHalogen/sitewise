import pc from 'picocolors';
import { isBrowserRunning } from './browser/cdp.js';
import { findChrome } from './browser/chrome.js';
import { getJSON } from './http.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runDoctor(): Promise<{ checks: Check[]; healthy: boolean }> {
  const checks: Check[] = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js >= 20',
    ok: nodeMajor >= 20,
    detail: `running ${process.versions.node}`,
  });

  try {
    await getJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1');
    checks.push({ name: 'Network / API reachability', ok: true, detail: 'public APIs reachable' });
  } catch (e) {
    checks.push({ name: 'Network / API reachability', ok: false, detail: String(e) });
  }

  const chrome = findChrome();
  checks.push({
    name: 'Chrome-family browser installed',
    ok: chrome !== null,
    detail: chrome ?? 'none found (browser commands unavailable; adapters still work)',
  });

  const cdp = await isBrowserRunning();
  checks.push({
    name: 'Browser control endpoint',
    ok: cdp,
    detail: cdp ? 'CDP responding on port 9222' : 'not running — start with `webctl browser start`',
  });

  return { checks, healthy: checks.every((c) => c.ok || c.name.startsWith('Browser')) };
}

export function renderDoctor(result: { checks: Check[]; healthy: boolean }): string {
  const lines = result.checks.map(
    (c) => `${c.ok ? pc.green('✓') : pc.yellow('✗')} ${pc.bold(c.name)} ${pc.dim('— ' + c.detail)}`,
  );
  lines.push('');
  lines.push(result.healthy ? pc.green('webctl is ready.') : pc.yellow('Some checks failed — see above.'));
  return lines.join('\n');
}
