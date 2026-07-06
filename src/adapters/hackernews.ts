import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';
import { timeAgo } from '../output.js';

const API = 'https://hn.algolia.com/api/v1';

interface AlgoliaHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  author: string;
  created_at: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

function toStory(h: AlgoliaHit) {
  return {
    id: Number(h.objectID),
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points,
    comments: h.num_comments,
    author: h.author,
    createdAt: h.created_at,
  };
}

const storyTable = (stories: ReturnType<typeof toStory>[]) => ({
  columns: [
    { key: 'points', header: 'Points', align: 'right' as const },
    { key: 'title', header: 'Title', maxWidth: 70 },
    { key: 'comments', header: 'Cmts', align: 'right' as const },
    { key: 'age', header: 'Age' },
    { key: 'url', header: 'URL', maxWidth: 45 },
  ],
  rows: stories.map((s) => ({ ...s, age: timeAgo(s.createdAt) })),
});

export const hackernews: Adapter = {
  name: 'hackernews',
  description: 'Hacker News — front page, newest, and search',
  commands: [
    {
      name: 'top',
      description: 'Current front-page stories',
      options: [{ flags: '-l, --limit <n>', description: 'number of stories', default: 15 }],
      async run(ctx) {
        const limit = Number(ctx.opts.limit);
        const res = await getJSON<AlgoliaResponse>(`${API}/search?tags=front_page&hitsPerPage=${limit}`);
        const stories = res.hits.map(toStory).sort((a, b) => b.points - a.points);
        return { data: stories, table: storyTable(stories) };
      },
    },
    {
      name: 'new',
      description: 'Newest stories',
      options: [{ flags: '-l, --limit <n>', description: 'number of stories', default: 15 }],
      async run(ctx) {
        const limit = Number(ctx.opts.limit);
        const res = await getJSON<AlgoliaResponse>(`${API}/search_by_date?tags=story&hitsPerPage=${limit}`);
        const stories = res.hits.map(toStory);
        return { data: stories, table: storyTable(stories) };
      },
    },
    {
      name: 'search',
      description: 'Search stories by relevance',
      args: [{ name: '<query>', description: 'search terms' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of results', default: 15 }],
      async run(ctx) {
        const limit = Number(ctx.opts.limit);
        const q = encodeURIComponent(ctx.args[0]);
        const res = await getJSON<AlgoliaResponse>(`${API}/search?query=${q}&tags=story&hitsPerPage=${limit}`);
        const stories = res.hits.map(toStory);
        return { data: stories, table: storyTable(stories) };
      },
    },
  ],
};
