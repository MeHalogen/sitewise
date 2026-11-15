#!/usr/bin/env node
/**
 * Nightly canary: keep one GitHub issue per broken adapter in sync with the
 * health report from `sitewise doctor --adapters --json`.
 *   - broken and no open issue  -> open one
 *   - broken and an open issue  -> refresh its body with the latest error
 *   - healthy and an open issue -> comment and close it
 * Uses the `gh` CLI (preinstalled on GitHub runners; needs GH_TOKEN).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LABEL = 'canary';
export const titleFor = (r) => `[canary] ${r.site} ${r.command} is failing`;

export function bodyFor(r, checkedAt, version) {
  return [
    `The nightly canary could not get data from \`sitewise ${[r.site, r.command, ...r.args].join(' ')}\`.`,
    '',
    `- **Status:** ${r.status}`,
    `- **Last checked:** ${checkedAt} (sitewise ${version})`,
    '',
    '```',
    String(r.error ?? 'returned no data').slice(0, 2000),
    '```',
    '',
    'This issue updates every night and closes itself when the adapter is healthy again.',
  ].join('\n');
}

/** Pure planning step, so it can be tested without GitHub. */
export function planIssues(report, openIssues) {
  const broken = report.results.filter((r) => r.status === 'fail' || r.status === 'empty');
  const healthy = new Set(report.results.filter((r) => r.status === 'ok').map(titleFor));
  const byTitle = new Map(openIssues.map((i) => [i.title, i]));
  const actions = [];
  for (const r of broken) {
    const title = titleFor(r);
    const body = bodyFor(r, report.checkedAt, report.version);
    const existing = byTitle.get(title);
    actions.push(existing ? { kind: 'update', number: existing.number, body } : { kind: 'open', title, body });
  }
  for (const issue of openIssues) {
    if (healthy.has(issue.title)) actions.push({ kind: 'close', number: issue.number });
  }
  return actions;
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function main(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  gh('label', 'create', LABEL, '--color', 'B60205', '--description', 'Opened by the nightly adapter canary', '--force');
  const open = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '200', '--json', 'number,title'));
  for (const a of planIssues(report, open)) {
    if (a.kind === 'open') gh('issue', 'create', '--title', a.title, '--body', a.body, '--label', LABEL);
    if (a.kind === 'update') gh('issue', 'edit', String(a.number), '--body', a.body);
    if (a.kind === 'close') gh('issue', 'close', String(a.number), '--comment', `Healthy again as of ${report.checkedAt}.`);
    console.log(a.kind, a.number ?? a.title);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2] ?? 'status.json');
