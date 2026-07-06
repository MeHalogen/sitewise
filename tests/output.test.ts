import { describe, expect, it } from 'vitest';
import { formatNumber, renderTable, timeAgo } from '../src/output.js';

describe('formatNumber', () => {
  it('abbreviates large numbers', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
    expect(formatNumber(12_300)).toBe('12.3k');
    expect(formatNumber(999)).toBe('999');
  });

  it('keeps small floats readable', () => {
    expect(formatNumber(3.14159)).toBe('3.14');
  });
});

describe('timeAgo', () => {
  it('renders minutes, hours, and days', () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000))).toBe('3h ago');
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000))).toBe('2d ago');
  });

  it('accepts unix seconds', () => {
    expect(timeAgo(Math.floor(Date.now() / 1000) - 120)).toBe('2m ago');
  });
});

describe('renderTable', () => {
  it('renders headers and rows', () => {
    const out = renderTable({
      columns: [
        { key: 'a', header: 'Alpha' },
        { key: 'b', header: 'Beta', align: 'right' },
      ],
      rows: [
        { a: 'one', b: 1 },
        { a: 'two', b: 22 },
      ],
    });
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('Alpha');
    expect(lines[2]).toContain('one');
    expect(lines[3]).toContain('two');
  });

  it('truncates long cells to maxWidth', () => {
    const out = renderTable({
      columns: [{ key: 'a', header: 'A', maxWidth: 10 }],
      rows: [{ a: 'x'.repeat(50) }],
    });
    const dataLine = out.split('\n')[2];
    expect(dataLine).toContain('…');
    // strip ANSI codes before measuring
    expect(dataLine.replace(/\[[0-9;]*m/g, '').length).toBeLessThanOrEqual(10);
  });
});
