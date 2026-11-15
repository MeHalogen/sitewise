/** Shared URL templating for declarative adapters. */

/**
 * Fill a URL template: `{query}` = all args joined, `{0}`,`{1}` = positional
 * args (URL-encoded, `{0|all}` gives a default), `{limit}` = the requested page
 * size, so `--limit` reaches the API instead of only slicing a fixed-size
 * response, and `{name}` = any other option value.
 */
export function resolveUrl(
  template: string,
  args: string[],
  vars: Record<string, string | number | boolean | undefined> = {},
): string {
  let url = template.replace(/\{query\}/g, encodeURIComponent(args.join(' ')));
  // `{0}` or `{0|all}` (a default for an optional positional arg)
  url = url.replace(/\{(\d+)(?:\|([^}]*))?\}/g, (_, i, fallback) => encodeURIComponent(args[Number(i)] || fallback || ''));
  // named values: `{limit}` (a positive integer) and any option, e.g. `{time}`
  url = url.replace(/\{([a-zA-Z]\w*)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    if (name === 'limit') {
      const n = Number(value);
      return Number.isFinite(n) ? String(Math.max(1, Math.floor(n))) : whole;
    }
    return encodeURIComponent(String(value));
  });
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
