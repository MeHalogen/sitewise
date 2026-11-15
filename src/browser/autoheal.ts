import { defaultLLM, llmAvailable, type LLM } from '../llm.js';
import { runBrowserCommandDetailed, type BrowserRunDetail } from './adapter-runtime.js';
import { DEFAULT_CDP_PORT } from './cdp.js';
import type { BrowserAdapterSpec, BrowserCommandSpec, BrowserRunner } from './declarative.js';
import { countUsableRows, healAgainstHtml } from './heal.js';
import { applyHeal, persistSpec } from './heal-store.js';

/**
 * Auto-heal: when a browser command extracts nothing and an LLM key is present,
 * repair the selectors inline and carry on, instead of making the user run
 * `sitewise heal`. The same rule as manual healing applies: a repair is saved
 * only if it actually extracts rows from the live page.
 * Opt out with SITEWISE_AUTOHEAL=0.
 */

export function autoHealEnabled(): boolean {
  return llmAvailable() && process.env.SITEWISE_AUTOHEAL !== '0';
}

export interface AutoHealDeps {
  run: (spec: BrowserCommandSpec, url: string) => Promise<BrowserRunDetail>;
  llm: () => LLM;
  persist: (spec: BrowserAdapterSpec) => string;
  enabled: () => boolean;
  notice: (line: string) => void;
}

const defaultDeps = (port: number): AutoHealDeps => ({
  run: (spec, url) => runBrowserCommandDetailed(spec, url, port),
  llm: defaultLLM,
  persist: persistSpec,
  enabled: autoHealEnabled,
  // stderr, so --json output and the MCP protocol stream stay clean
  notice: (line) => process.stderr.write(`sitewise: ${line}\n`),
});

/** A runner for one adapter, so a repair knows which adapter file to save. */
export function createHealingRunner(
  adapter: BrowserAdapterSpec,
  port = DEFAULT_CDP_PORT,
  deps: Partial<AutoHealDeps> = {},
): BrowserRunner {
  const d = { ...defaultDeps(port), ...deps };
  let current = adapter; // later heals in the same process build on earlier ones
  return async (spec, url) => {
    const { rows, html } = await d.run(spec, url);
    if (countUsableRows(rows) > 0 || !d.enabled()) return rows;

    d.notice(`${adapter.name} ${spec.name} returned no data; repairing its selectors…`);
    const result = await healAgainstHtml(d.llm(), spec, html);
    if (!result.healed || !result.proposal) {
      d.notice(`could not repair automatically (${result.reason}). Try \`sitewise doctor --adapters --browser --only ${adapter.name}\`.`);
      return rows;
    }
    current = applyHeal(current, spec.name, result.proposal);
    const file = d.persist(current);
    d.notice(`repaired ${adapter.name} ${spec.name} (${countUsableRows(result.rows)} rows); saved to ${file}`);
    return result.rows;
  };
}
