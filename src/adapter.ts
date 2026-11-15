/** Core adapter types. An adapter turns a website/service into a set of CLI commands. */

export interface ArgSpec {
  /** e.g. "<query>" or "[subreddit]" — commander syntax */
  name: string;
  description: string;
}

export interface OptionSpec {
  /** e.g. "-l, --limit <n>" — commander syntax */
  flags: string;
  description: string;
  default?: string | number | boolean;
}

export interface CommandContext {
  /** positional args in declared order */
  args: string[];
  /** parsed option values keyed by camelCase name */
  opts: Record<string, unknown>;
}

export interface TableSpec {
  columns: { key: string; header: string; align?: 'left' | 'right'; maxWidth?: number }[];
  rows: Record<string, unknown>[];
}

export interface CommandResult {
  /** machine-readable payload, printed verbatim with --json */
  data: unknown;
  /** human rendering: a table... */
  table?: TableSpec;
  /** ...or plain/markdown text */
  text?: string;
}

export interface AdapterCommand {
  name: string;
  description: string;
  args?: ArgSpec[];
  options?: OptionSpec[];
  /** positional args for a representative call; shown in --help and used by `doctor --adapters` */
  example?: string[];
  run(ctx: CommandContext): Promise<CommandResult>;
}

export interface Adapter {
  name: string;
  description: string;
  /** how the adapter fetches data — public API or a driven browser */
  mode?: 'api' | 'browser';
  /** selectors not yet verified against a live (logged-in) session */
  experimental?: boolean;
  commands: AdapterCommand[];
}

/** camelCase option key from commander flags: "-t, --time <window>" -> "time", "--dry-run" -> "dryRun". */
export function optionKey(flags: string): string {
  const long = flags.match(/--([a-z0-9-]+)/i)?.[1] ?? '';
  return long.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export type OptionValue = string | number | boolean;

/**
 * The option values a command runs with when it is not invoked through
 * commander (ask, dash, watch, MCP): every declared default, then the caller's
 * overrides. Unknown keys are rejected so a typo never silently does nothing.
 */
export function resolveOptions(
  cmd: Pick<AdapterCommand, 'options'>,
  overrides: Record<string, OptionValue | undefined> = {},
): Record<string, unknown> {
  const declared = new Map((cmd.options ?? []).map((o) => [optionKey(o.flags), o]));
  const opts: Record<string, unknown> = {};
  for (const [key, o] of declared) if (o.default !== undefined) opts[key] = o.default;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!declared.has(key)) {
      const known = [...declared.keys()];
      throw new Error(`unknown option "${key}"${known.length ? ` (this command accepts: ${known.join(', ')})` : ' (this command takes no options)'}`);
    }
    opts[key] = value;
  }
  return opts;
}

/** `{ limit: n }` when the command takes --limit, otherwise nothing (text commands have no limit). */
export function limitOverride(cmd: Pick<AdapterCommand, 'options'>, limit: number | undefined): Record<string, OptionValue | undefined> {
  const takesLimit = (cmd.options ?? []).some((o) => optionKey(o.flags) === 'limit');
  return takesLimit && limit !== undefined ? { limit } : {};
}
