import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { planIssues, titleFor } from '../scripts/canary-issues.mjs';

const report = {
  checkedAt: '2026-11-16T06:17:00Z',
  version: '1.3.0',
  results: [
    { site: 'npm', command: 'search', args: ['react'], status: 'ok' },
    { site: 'art', command: 'search', args: ['monet'], status: 'fail', error: 'HTTP 403' },
    { site: 'quotes', command: 'random', args: [], status: 'empty' },
  ],
};

describe('canary issue sync', () => {
  it('opens, refreshes and closes one issue per adapter', () => {
    const open = [
      { number: 7, title: titleFor({ site: 'art', command: 'search' }) },
      { number: 9, title: titleFor({ site: 'npm', command: 'search' }) },
      { number: 11, title: 'unrelated' },
    ];
    const actions = planIssues(report, open);
    expect(actions.map((a: { kind: string; number?: number; title?: string }) => [a.kind, a.number ?? a.title])).toEqual([
      ['update', 7],
      ['open', '[canary] quotes random is failing'],
      ['close', 9],
    ]);
    expect(actions[0].body).toContain('HTTP 403');
    expect(actions[0].body).toContain('sitewise art search monet');
  });
});
