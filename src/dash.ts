import pc from 'picocolors';
import type { DashPanel } from './config.js';
import { loadConfig } from './config.js';
import { render } from './output.js';
import { limitOverride, resolveOptions } from './adapter.js';
import { findCommand } from './registry.js';

/** The personal terminal dashboard: run every configured panel, render stacked sections. */

export function defaultPanels(city?: string): DashPanel[] {
  const panels: DashPanel[] = [
    { site: 'hackernews', command: 'top', limit: 5, title: 'Hacker News' },
    { site: 'crypto', command: 'top', limit: 5, title: 'Crypto' },
    { site: 'devto', command: 'top', limit: 5, title: 'DEV Community' },
  ];
  if (city) panels.splice(1, 0, { site: 'weather', command: 'now', args: [city], title: `Weather — ${city}` });
  return panels;
}

export function panelLabel(p: DashPanel): string {
  return p.title ?? [p.site, p.command, ...(p.args ?? [])].join(' ');
}

export async function renderDash(): Promise<string> {
  const { dash } = loadConfig();
  if (dash.length === 0) {
    return [
      'No dashboard configured yet.',
      '',
      `  ${pc.cyan('sitewise dash init --city "Your City"')}   set up a starter dashboard`,
      `  ${pc.cyan('sitewise dash add reddit hot rust')}        add any command as a panel`,
    ].join('\n');
  }

  const results = await Promise.allSettled(
    dash.map(async (panel) => {
      const cmd = findCommand(panel.site, panel.command);
      if (!cmd) throw new Error(`unknown command ${panel.site}/${panel.command}`);
      return cmd.run({ args: panel.args ?? [], opts: resolveOptions(cmd, limitOverride(cmd, panel.limit ?? 5)) });
    }),
  );

  const sections = results.map((res, i) => {
    const header = pc.bold(pc.cyan(`── ${panelLabel(dash[i])} `)) + pc.dim('─'.repeat(Math.max(0, 40 - panelLabel(dash[i]).length)));
    if (res.status === 'rejected') {
      return `${header}\n${pc.red('error:')} ${pc.dim(String(res.reason?.message ?? res.reason))}`;
    }
    return `${header}\n${render(res.value, false)}`;
  });

  const stamp = pc.dim(new Date().toLocaleString());
  return [pc.bold('sitewise dash') + '  ' + stamp, '', sections.join('\n\n')].join('\n');
}
