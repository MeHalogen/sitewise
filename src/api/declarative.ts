import type { Adapter, CommandContext, CommandResult, TableSpec } from '../adapter.js';
import { getJSON } from '../http.js';
import { getPath, resolveUrl, toCell } from '../template.js';

/**
 * Declarative API adapter: fetch a no-key public JSON endpoint and map it to
 * rows. Same philosophy as the browser adapters — a site becomes plain data.
 */
export interface ApiCommandSpec {
  name: string;
  description: string;
  /** URL template; `{query}` = args joined, `{0}`,`{1}` = positional (URL-encoded) */
  url: string;
  headers?: Record<string, string>;
  /** dot path to the array of items in the response; omit if the response IS the array */
  root?: string;
  /** output field -> dot path within each item */
  item?: Record<string, string>;
  /**
   * For single-object endpoints: dot paths to render as a text block instead of a table.
   * Each entry is "Label:path" or just "path".
   */
  text?: string[];
  columns?: string[];
  args?: { name: string; description: string }[];
  /** max rows (client-side slice) */
  limit?: number;
}

export interface ApiAdapterSpec {
  name: string;
  description: string;
  commands: ApiCommandSpec[];
}

function buildRows(spec: ApiCommandSpec, payload: unknown, limit: number): Record<string, string>[] {
  const arr = spec.root !== undefined ? getPath(payload, spec.root) : payload;
  const items = Array.isArray(arr) ? arr.slice(0, limit) : [];
  const fields = spec.item ?? {};
  return items.map((it) => {
    const row: Record<string, string> = {};
    for (const key of Object.keys(fields)) row[key] = toCell(getPath(it, fields[key]));
    return row;
  });
}

function buildText(spec: ApiCommandSpec, payload: unknown): string {
  return (spec.text ?? [])
    .map((entry) => {
      const [label, path] = entry.includes(':') ? entry.split(/:(.+)/) : [undefined, entry];
      const value = toCell(getPath(payload, path));
      return label ? `${label}: ${value}` : value;
    })
    .filter((line) => line && !line.endsWith(': '))
    .join('\n');
}

export function buildApiResult(spec: ApiCommandSpec, payload: unknown, limit: number): CommandResult {
  if (spec.text) return { data: payload, text: buildText(spec, payload) };
  const rows = buildRows(spec, payload, limit);
  const columns = spec.columns ?? Object.keys(spec.item ?? {});
  const table: TableSpec = {
    columns: columns.map((key) => ({ key, header: key, maxWidth: 60 })),
    rows,
  };
  return { data: rows, table };
}

export function loadApiAdapter(spec: ApiAdapterSpec): Adapter {
  return {
    name: spec.name,
    description: spec.description,
    mode: 'api',
    commands: spec.commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      args: cmd.args,
      options: cmd.text ? [] : [{ flags: '-l, --limit <n>', description: 'max rows', default: cmd.limit ?? 20 }],
      async run(ctx: CommandContext): Promise<CommandResult> {
        const url = resolveUrl(cmd.url, ctx.args);
        const limit = ctx.opts.limit !== undefined ? Number(ctx.opts.limit) : (cmd.limit ?? 20);
        const payload = await getJSON(url, cmd.headers);
        return buildApiResult(cmd, payload, limit);
      },
    })),
  };
}
