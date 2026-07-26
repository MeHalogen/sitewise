import { JSDOM } from 'jsdom';
import type { LLM } from '../llm.js';
import type { BrowserAdapterSpec } from './declarative.js';
import { extractRows } from './extract.js';
import { condenseHtml, countUsableRows, type HealProposal } from './heal.js';

/**
 * Agent-authored adapters: create a brand-new browser adapter for a site from
 * a URL and a list of fields to capture. Same safety principle as healing —
 * whether the selectors come from the LLM (CLI) or from an agent over MCP, we
 * VERIFY them against the live DOM before saving, so a bad adapter never lands.
 */

export interface AuthorRequest {
  site: string;
  command: string;
  url: string;
  /** field names to extract, e.g. ["title", "price", "url"] */
  want: string[];
  description?: string;
}

export function buildAuthorPrompt(req: AuthorRequest, html: string): string {
  return [
    `Write CSS selectors to scrape a list from this web page.`,
    `Extract these fields for each repeated item: ${req.want.join(', ')}.`,
    ``,
    `Page HTML (condensed):`,
    `"""`,
    condenseHtml(html),
    `"""`,
    ``,
    `Respond with ONLY this JSON:`,
    `{"selector": "<CSS selector for each repeated item>", "fields": {${req.want
      .map((f) => `"${f}": {"selector": "<selector relative to item, or omit for the item itself>", "attr": "<optional attribute e.g. href>", "absolute": <true for href/src>}`)
      .join(', ')}}}`,
    ``,
    `Prefer stable selectors (data-* attributes, semantic tags) over generated class names. Omit "attr" for text. No prose, no code fences.`,
  ].join('\n');
}

/** Build a full adapter spec from a verified proposal (shared by the CLI and MCP paths). */
export function buildAdapterSpec(req: AuthorRequest, proposal: HealProposal): BrowserAdapterSpec {
  return {
    name: req.site,
    description: req.description ?? `[browser] ${req.site} — ${req.command}`,
    commands: [
      {
        name: req.command,
        description: req.description ?? `Extract ${req.want.join(', ')}`,
        url: req.url,
        waitFor: proposal.selector,
        columns: req.want,
        list: { selector: proposal.selector, limit: 25, fields: proposal.fields },
      },
    ],
  };
}

export interface AuthorResult {
  ok: boolean;
  spec?: BrowserAdapterSpec;
  rows: Record<string, string>[];
  reason?: string;
}

/** Verify a proposal against the page HTML, returning a ready-to-save spec if it extracts data. */
export function verifyAndBuild(req: AuthorRequest, proposal: HealProposal, html: string): AuthorResult {
  if (!proposal?.selector || !proposal.fields) return { ok: false, rows: [], reason: 'no selectors provided' };
  const doc = new JSDOM(html).window.document;
  const rows = extractRows(doc, { selector: proposal.selector, limit: 25, fields: proposal.fields });
  if (countUsableRows(rows) === 0) return { ok: false, rows, reason: 'selectors extracted no data from the page' };
  return { ok: true, spec: buildAdapterSpec(req, proposal), rows };
}

/** CLI path: let the LLM propose selectors, then verify + build. */
export async function authorWithLLM(llm: LLM, req: AuthorRequest, html: string): Promise<AuthorResult> {
  let proposal: HealProposal;
  try {
    proposal = await llm.json<HealProposal>(buildAuthorPrompt(req, html), {
      system: 'You are a web-scraping expert. You respond only with JSON.',
    });
  } catch (err) {
    return { ok: false, rows: [], reason: (err as Error).message };
  }
  return verifyAndBuild(req, proposal, html);
}
