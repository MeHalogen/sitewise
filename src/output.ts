import pc from 'picocolors';
import type { CommandResult, TableSpec } from './adapter.js';

/** Render a result for humans (tables/colors) or machines (--json). */
export function render(result: CommandResult, json: boolean): string {
  if (json) return JSON.stringify(result.data, null, 2);
  if (result.table) return renderTable(result.table);
  if (result.text) return result.text;
  return JSON.stringify(result.data, null, 2);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value);
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(s: string, width: number): string {
  if (s.length <= width) return s;
  return s.slice(0, Math.max(0, width - 1)) + '…';
}

export function renderTable(spec: TableSpec): string {
  const termWidth = process.stdout.columns ?? 120;
  const cols = spec.columns;

  const widths = cols.map((c) => {
    const contentMax = Math.max(c.header.length, ...spec.rows.map((r) => cellText(r[c.key]).length));
    return Math.min(contentMax, c.maxWidth ?? 60);
  });

  // Shrink the widest columns until the table fits the terminal.
  const gap = 2;
  let total = widths.reduce((a, b) => a + b, 0) + gap * (cols.length - 1);
  while (total > termWidth) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest] <= 8) break;
    widths[widest] -= 1;
    total -= 1;
  }

  const pad = (s: string, w: number, align?: 'left' | 'right') =>
    align === 'right' ? s.padStart(w) : s.padEnd(w);

  const lines: string[] = [];
  lines.push(cols.map((c, i) => pc.bold(pad(truncate(c.header, widths[i]), widths[i], c.align))).join('  '));
  lines.push(pc.dim(cols.map((_, i) => '─'.repeat(widths[i])).join('  ')));
  for (const row of spec.rows) {
    lines.push(
      cols
        .map((c, i) => {
          const raw = pad(truncate(cellText(row[c.key]), widths[i]), widths[i], c.align);
          return c.align === 'right' ? pc.cyan(raw) : raw;
        })
        .join('  '),
    );
  }
  return lines.join('\n');
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

/** "3h ago", "2d ago" — from a Date, ISO string, or unix seconds. */
export function timeAgo(input: Date | string | number): string {
  const date =
    input instanceof Date ? input : typeof input === 'number' ? new Date(input * 1000) : new Date(input);
  const ms = Date.now() - date.getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
