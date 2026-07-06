import { describe, expect, it } from 'vitest';
import { parseFeed } from '../src/adapters/rss.js';

const RSS2 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  <item><title>First post</title><link>https://example.com/1</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
  <item><title>Second post</title><link>https://example.com/2</link><pubDate>Tue, 02 Jun 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Entry one</title>
    <link rel="alternate" href="https://example.org/a"/>
    <updated>2026-06-01T10:00:00Z</updated>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('parses RSS 2.0', () => {
    const feed = parseFeed(RSS2);
    expect(feed.title).toBe('Example Blog');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toEqual({
      title: 'First post',
      url: 'https://example.com/1',
      published: 'Mon, 01 Jun 2026 10:00:00 GMT',
    });
  });

  it('parses Atom', () => {
    const feed = parseFeed(ATOM);
    expect(feed.title).toBe('Atom Feed');
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].url).toBe('https://example.org/a');
  });

  it('rejects non-feed XML', () => {
    expect(() => parseFeed('<html><body>nope</body></html>')).toThrow(/RSS or Atom/);
  });

  it('handles a single-item feed (non-array)', () => {
    const single = RSS2.replace(/<item>.*<\/item>\s*(?=<item>)/s, '');
    const feed = parseFeed(single);
    expect(feed.items).toHaveLength(1);
  });
});
