import type { Adapter, CommandContext, CommandResult } from '../adapter.js';
import { resolveUrl } from '../template.js';
import type { ListSpec } from './extract.js';

export { resolveUrl };

/** A single command in a declarative browser adapter. */
export interface BrowserCommandSpec {
  name: string;
  description: string;
  /**
   * URL template. `{0}`, `{1}`... are replaced by positional args
   * (URL-encoded); `{query}` is replaced by all args joined with spaces.
   */
  url: string;
  /** wait until this selector appears (JS-rendered pages) before extracting */
  waitFor?: string;
  /** how to pull rows out of the page */
  list: ListSpec;
  args?: { name: string; description: string }[];
  /** field order for the human table; defaults to the field keys */
  columns?: string[];
}

export interface BrowserAdapterSpec {
  name: string;
  description: string;
  commands: BrowserCommandSpec[];
}

/** Runs a resolved browser command against a real browser. Injected so the loader is testable. */
export type BrowserRunner = (spec: BrowserCommandSpec, resolvedUrl: string) => Promise<Record<string, string>[]>;

function toResult(spec: BrowserCommandSpec, rows: Record<string, string>[]): CommandResult {
  const columns = spec.columns ?? Object.keys(spec.list.fields);
  return {
    data: rows,
    table: {
      columns: columns.map((key) => ({ key, header: key, maxWidth: 60 })),
      rows,
    },
  };
}

/** Build a runtime Adapter from a declarative spec, given a runner that drives the browser. */
export function loadBrowserAdapter(spec: BrowserAdapterSpec, runner: BrowserRunner): Adapter {
  return {
    name: spec.name,
    description: spec.description,
    mode: 'browser',
    commands: spec.commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      args: cmd.args,
      options: [{ flags: '-l, --limit <n>', description: 'max rows', default: cmd.list.limit ?? 25 }],
      async run(ctx: CommandContext): Promise<CommandResult> {
        const url = resolveUrl(cmd.url, ctx.args);
        const limit = ctx.opts.limit !== undefined ? Number(ctx.opts.limit) : cmd.list.limit;
        const effective: BrowserCommandSpec = { ...cmd, list: { ...cmd.list, limit } };
        const rows = await runner(effective, url);
        return toResult(effective, rows);
      },
    })),
  };
}
