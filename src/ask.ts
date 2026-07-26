import type { LLM } from './llm.js';

/**
 * Natural-language routing: turn "cheapest mechanical keyboard on amazon" into
 * a concrete `site command args` call. The LLM only *chooses* from the real
 * catalog; we validate its choice against the registry before running anything,
 * so it can't invent a command that doesn't exist.
 */

export interface Route {
  site: string;
  command: string;
  args: string[];
}

export interface CommandInfo {
  site: string;
  command: string;
  description: string;
}

export function buildRoutePrompt(query: string, commands: CommandInfo[]): string {
  const catalog = commands.map((c) => `${c.site} ${c.command} — ${c.description}`).join('\n');
  return [
    `You translate a natural-language request into exactly one command from this catalog:`,
    ``,
    catalog,
    ``,
    `Request: ${JSON.stringify(query)}`,
    ``,
    `Respond with ONLY this JSON (no prose, no code fences):`,
    `{"site": "<site>", "command": "<command>", "args": ["<positional arg>", ...]}`,
    ``,
    `"args" are positional arguments such as a search query, username, or city — join multi-word values into one string. Use [] when the command takes none. Choose the single best match.`,
  ].join('\n');
}

/** Ensure the model picked a real command; normalize args to strings. */
export function validateRoute(candidate: unknown, commands: CommandInfo[]): Route {
  const c = candidate as Partial<Route> | null;
  if (!c || typeof c.site !== 'string' || typeof c.command !== 'string') {
    throw new Error('could not understand that request');
  }
  const exists = commands.some((cmd) => cmd.site === c.site && cmd.command === c.command);
  if (!exists) throw new Error(`no command matches that request (model suggested "${c.site} ${c.command}")`);
  const args = Array.isArray(c.args) ? c.args.map((a) => String(a)) : [];
  return { site: c.site, command: c.command, args };
}

export async function route(llm: LLM, query: string, commands: CommandInfo[]): Promise<Route> {
  const candidate = await llm.json<Route>(buildRoutePrompt(query, commands), {
    system: 'You translate natural-language requests into CLI commands. You respond only with JSON.',
  });
  return validateRoute(candidate, commands);
}
