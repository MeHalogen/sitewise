import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';

interface WikiSearchPage {
  title: string;
  description: string | null;
  excerpt: string;
}

interface WikiSummary {
  title: string;
  description?: string;
  extract: string;
  content_urls: { desktop: { page: string } };
}

export const wikipedia: Adapter = {
  name: 'wikipedia',
  description: 'Wikipedia — article summaries and search',
  commands: [
    {
      name: 'summary',
      description: 'Summary of an article',
      args: [{ name: '<title>', description: 'article title, e.g. "Alan Turing"' }],
      async run(ctx) {
        const title = encodeURIComponent(ctx.args[0].replace(/ /g, '_'));
        const s = await getJSON<WikiSummary>(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
        const data = {
          title: s.title,
          description: s.description ?? '',
          extract: s.extract,
          url: s.content_urls.desktop.page,
        };
        const text = [`${data.title} — ${data.description}`, '', data.extract, '', data.url].join('\n');
        return { data, text };
      },
    },
    {
      name: 'search',
      description: 'Search articles',
      args: [{ name: '<query>', description: 'search terms' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of results', default: 10 }],
      async run(ctx) {
        const q = encodeURIComponent(ctx.args[0]);
        const res = await getJSON<{ pages: WikiSearchPage[] }>(
          `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${q}&limit=${Number(ctx.opts.limit)}`,
        );
        const rows = res.pages.map((p) => ({
          title: p.title,
          description: p.description ?? '',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        }));
        return {
          data: rows,
          table: {
            columns: [
              { key: 'title', header: 'Title', maxWidth: 40 },
              { key: 'description', header: 'Description', maxWidth: 60 },
            ],
            rows,
          },
        };
      },
    },
  ],
};
