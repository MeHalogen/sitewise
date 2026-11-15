import { XMLParser } from 'fast-xml-parser';
import type { Adapter } from '../adapter.js';
import { getText } from '../http.js';
import { timeAgo } from '../output.js';

interface FeedItem {
  title: string;
  url: string;
  published: string;
}

/** Parse RSS 2.0 or Atom into a flat item list. */
export function parseFeed(xml: string): { title: string; items: FeedItem[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);

  if (doc.rss?.channel) {
    const ch = doc.rss.channel;
    const raw = ch.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : [];
    return {
      title: String(ch.title ?? ''),
      items: raw.map((i: Record<string, unknown>) => ({
        title: String(i.title ?? ''),
        url: String(i.link ?? ''),
        published: String(i.pubDate ?? ''),
      })),
    };
  }

  if (doc.feed) {
    const raw = doc.feed.entry ? (Array.isArray(doc.feed.entry) ? doc.feed.entry : [doc.feed.entry]) : [];
    return {
      title: String(doc.feed.title?.['#text'] ?? doc.feed.title ?? ''),
      items: raw.map((e: Record<string, any>) => {
        const links = e.link ? (Array.isArray(e.link) ? e.link : [e.link]) : [];
        const alt = links.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']) ?? links[0];
        return {
          title: String(e.title?.['#text'] ?? e.title ?? ''),
          url: String(alt?.['@_href'] ?? ''),
          published: String(e.updated ?? e.published ?? ''),
        };
      }),
    };
  }

  throw new Error('Not a recognizable RSS or Atom feed.');
}

export const rss: Adapter = {
  name: 'rss',
  description: 'Read any RSS or Atom feed',
  commands: [
    {
      name: 'read',
      description: 'List the latest items in a feed',
      example: ['https://hnrss.org/frontpage'],
      args: [{ name: '<url>', description: 'feed URL' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of items', default: 15 }],
      async run(ctx) {
        const feed = parseFeed(await getText(ctx.args[0]));
        const items = feed.items.slice(0, Number(ctx.opts.limit));
        return {
          data: { title: feed.title, items },
          table: {
            columns: [
              { key: 'title', header: feed.title || 'Title', maxWidth: 70 },
              { key: 'age', header: 'Published' },
              { key: 'url', header: 'URL', maxWidth: 50 },
            ],
            rows: items.map((i) => ({ ...i, age: i.published ? timeAgo(i.published) : '' })),
          },
        };
      },
    },
  ],
};
