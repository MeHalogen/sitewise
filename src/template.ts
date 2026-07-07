/** Shared URL templating for declarative adapters. */

export function resolveUrl(template: string, args: string[]): string {
  let url = template.replace(/\{query\}/g, encodeURIComponent(args.join(' ')));
  url = url.replace(/\{(\d+)\}/g, (_, i) => encodeURIComponent(args[Number(i)] ?? ''));
  return url;
}

/**
 * Read a value from a nested object by dot path. Supports array indices
 * ("results.0.name") and returns undefined for any missing link in the chain.
 */
export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Coerce a JSON value to a flat display string. */
export function toCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return Array.isArray(value) ? value.map(toCell).join(', ') : JSON.stringify(value);
  return String(value);
}
