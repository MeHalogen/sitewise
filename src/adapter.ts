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
  run(ctx: CommandContext): Promise<CommandResult>;
}

export interface Adapter {
  name: string;
  description: string;
  commands: AdapterCommand[];
}
