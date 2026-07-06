import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
// @ts-expect-error - no types published for the gfm plugin
import { gfm } from 'turndown-plugin-gfm';
import { getText } from './http.js';

export interface Article {
  title: string;
  byline: string | null;
  excerpt: string | null;
  markdown: string;
  url: string;
}

/** Extract the main article from HTML and convert it to Markdown. */
export function htmlToArticle(html: string, url: string): Article {
  const dom = new JSDOM(html, { url });
  const parsed = new Readability(dom.window.document).parse();
  if (!parsed || !parsed.content) throw new Error(`Could not extract readable content from ${url}`);

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  turndown.use(gfm);
  const markdown = turndown.turndown(parsed.content);

  return {
    title: parsed.title ?? '',
    byline: parsed.byline ?? null,
    excerpt: parsed.excerpt ?? null,
    markdown,
    url,
  };
}

export async function readUrl(url: string): Promise<Article> {
  const html = await getText(url, { accept: 'text/html,application/xhtml+xml' });
  return htmlToArticle(html, url);
}
