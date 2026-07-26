import { JSDOM } from 'jsdom';
import type { LLM } from '../llm.js';
import type { BrowserCommandSpec } from './declarative.js';
import { extractRows, type ListSpec } from './extract.js';

/**
 * Self-healing adapters. When a browser command extracts 0 rows, the site's
 * markup probably changed. We hand the live DOM + the fields we want to an LLM,
 * ask it for fresh selectors, and — crucially — VERIFY its answer against the
 * same DOM before trusting it. A repair is only accepted if it actually yields
 * rows, so a hallucinated selector can never make things worse.
 */

export interface HealProposal {
  selector: string;
  fields: Record<string, { selector?: string; attr?: string; absolute?: boolean }>;
}

/** Trim a full-page HTML down to something an LLM can reason over cheaply. */
export function condenseHtml(html: string, maxChars = 18_000): string {
  // Drop script/style/svg noise, collapse whitespace, cap length.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) + ' …[truncated]' : stripped;
}

export function buildHealPrompt(spec: BrowserCommandSpec, html: string): string {
  const fields = Object.keys(spec.list.fields);
  return [
    `A CSS-selector-based scraper for a web page stopped returning results, so the page's markup likely changed.`,
    ``,
    `The scraper extracts a list of repeated items. For each item it reads these fields: ${fields.join(', ')}.`,
    `The selector that used to match each item was: ${JSON.stringify(spec.list.selector)}`,
    ``,
    `Here is the current page HTML (condensed):`,
    `"""`,
    condenseHtml(html),
    `"""`,
    ``,
    `Propose new selectors. Respond with ONLY a JSON object of this shape:`,
    `{"selector": "<CSS selector matching each repeated item>",`,
    ` "fields": {${fields.map((f) => `"${f}": {"selector": "<CSS selector relative to the item, or omit to use the item itself>", "attr": "<optional attribute like href>", "absolute": <true for href/src to resolve absolute URLs>}`).join(', ')}}}`,
    ``,
    `Rules: selectors must be valid CSS. Prefer stable attributes (data-*, semantic tags) over generated class names. Omit "attr" for text fields. No prose, no code fences — just the JSON.`,
  ].join('\n');
}

/** Turn a proposal into a ListSpec, preserving the original row limit. */
export function proposalToListSpec(proposal: HealProposal, limit?: number): ListSpec {
  return {
    selector: proposal.selector,
    limit,
    fields: proposal.fields,
  };
}

/** Count rows that have at least one non-empty field — the signal a repair worked. */
export function countUsableRows(rows: Record<string, string>[]): number {
  return rows.filter((r) => Object.values(r).some((v) => v && v.length > 0)).length;
}

export interface HealResult {
  healed: boolean;
  proposal?: HealProposal;
  rows: Record<string, string>[];
  reason?: string;
}

/**
 * Attempt to repair a broken command against the given page HTML.
 * Returns the healed proposal only if the new selectors actually extract rows.
 */
export async function healAgainstHtml(
  llm: LLM,
  spec: BrowserCommandSpec,
  html: string,
): Promise<HealResult> {
  let proposal: HealProposal;
  try {
    proposal = await llm.json<HealProposal>(buildHealPrompt(spec, html), {
      system: 'You are a web-scraping expert who repairs broken CSS selectors. You respond only with JSON.',
    });
  } catch (err) {
    return { healed: false, rows: [], reason: (err as Error).message };
  }
  if (!proposal?.selector || !proposal.fields) {
    return { healed: false, rows: [], reason: 'model did not return usable selectors' };
  }

  // Verify against the real DOM before trusting the model.
  const doc = new JSDOM(html).window.document;
  const rows = extractRows(doc, proposalToListSpec(proposal, spec.list.limit));
  if (countUsableRows(rows) === 0) {
    return { healed: false, proposal, rows, reason: 'proposed selectors still yielded no data' };
  }
  return { healed: true, proposal, rows };
}
