import { XMLParser } from 'fast-xml-parser';
import type { Adapter } from '../adapter.js';
import { getText } from '../http.js';
import { timeAgo } from '../output.js';

const API = 'https://export.arxiv.org/api/query';

interface AtomEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  author: { name: string } | { name: string }[];
}

function parseEntries(xml: string) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);
  const raw = doc?.feed?.entry;
  const entries: AtomEntry[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return entries.map((e) => {
    const authors = Array.isArray(e.author) ? e.author : [e.author];
    return {
      id: e.id.split('/abs/')[1] ?? e.id,
      title: String(e.title).replace(/\s+/g, ' ').trim(),
      summary: String(e.summary).replace(/\s+/g, ' ').trim(),
      authors: authors.map((a) => a.name),
      published: e.published,
      url: e.id,
    };
  });
}

const paperTable = (papers: ReturnType<typeof parseEntries>) => ({
  columns: [
    { key: 'id', header: 'ID' },
    { key: 'title', header: 'Title', maxWidth: 70 },
    { key: 'firstAuthor', header: 'First author', maxWidth: 24 },
    { key: 'age', header: 'Published' },
  ],
  rows: papers.map((p) => ({ ...p, firstAuthor: p.authors[0] ?? '', age: timeAgo(p.published) })),
});

async function query(searchQuery: string, limit: number, sortByDate: boolean) {
  const qs = new URLSearchParams({
    search_query: searchQuery,
    max_results: String(limit),
    ...(sortByDate ? { sortBy: 'submittedDate', sortOrder: 'descending' } : {}),
  });
  return parseEntries(await getText(`${API}?${qs}`));
}

export const arxiv: Adapter = {
  name: 'arxiv',
  description: 'arXiv — search papers and browse recent submissions by category',
  commands: [
    {
      name: 'search',
      description: 'Search papers across all fields',
      example: ['diffusion models'],
      args: [{ name: '<query>', description: 'search terms' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of papers', default: 10 }],
      async run(ctx) {
        const papers = await query(`all:${ctx.args[0]}`, Number(ctx.opts.limit), false);
        return { data: papers, table: paperTable(papers) };
      },
    },
    {
      name: 'recent',
      description: 'Most recent submissions in a category',
      example: ['cs.LG'],
      args: [{ name: '<category>', description: 'e.g. cs.AI, cs.CL, math.CO' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of papers', default: 10 }],
      async run(ctx) {
        const papers = await query(`cat:${ctx.args[0]}`, Number(ctx.opts.limit), true);
        return { data: papers, table: paperTable(papers) };
      },
    },
    {
      name: 'abstract',
      description: 'Full abstract of a paper',
      example: ['1706.03762'],
      args: [{ name: '<id>', description: 'arXiv ID, e.g. 2401.00001' }],
      async run(ctx) {
        const papers = await query(`id:${ctx.args[0]}`, 1, false);
        const p = papers[0];
        if (!p) return { data: null, text: 'Paper not found.' };
        const text = [p.title, p.authors.join(', '), '', p.summary, '', p.url].join('\n');
        return { data: p, text };
      },
    },
  ],
};
