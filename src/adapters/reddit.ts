import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';
import { timeAgo } from '../output.js';

interface RedditPost {
  data: {
    id: string;
    title: string;
    subreddit: string;
    score: number;
    num_comments: number;
    author: string;
    created_utc: number;
    permalink: string;
    url: string;
  };
}

interface RedditListing {
  data: { children: RedditPost[] };
}

function toPost(p: RedditPost) {
  const d = p.data;
  return {
    id: d.id,
    title: d.title,
    subreddit: d.subreddit,
    score: d.score,
    comments: d.num_comments,
    author: d.author,
    createdUtc: d.created_utc,
    permalink: `https://reddit.com${d.permalink}`,
    url: d.url,
  };
}

const postTable = (posts: ReturnType<typeof toPost>[]) => ({
  columns: [
    { key: 'score', header: 'Score', align: 'right' as const },
    { key: 'title', header: 'Title', maxWidth: 65 },
    { key: 'subreddit', header: 'Sub' },
    { key: 'comments', header: 'Cmts', align: 'right' as const },
    { key: 'age', header: 'Age' },
  ],
  rows: posts.map((p) => ({ ...p, age: timeAgo(p.createdUtc) })),
});

async function listing(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams({ raw_json: '1' });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await getJSON<RedditListing>(`https://www.reddit.com${path}?${qs}`);
  return res.data.children.map(toPost);
}

export const reddit: Adapter = {
  name: 'reddit',
  description: 'Reddit — hot/new/top posts and search, no login needed',
  commands: [
    {
      name: 'hot',
      description: 'Hot posts from a subreddit (or the front page)',
      args: [{ name: '[subreddit]', description: 'subreddit name, defaults to all' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of posts', default: 15 }],
      async run(ctx) {
        const sub = ctx.args[0] ?? 'all';
        const posts = await listing(`/r/${sub}/hot.json`, { limit: Number(ctx.opts.limit) });
        return { data: posts, table: postTable(posts) };
      },
    },
    {
      name: 'top',
      description: 'Top posts from a subreddit over a time window',
      args: [{ name: '[subreddit]', description: 'subreddit name, defaults to all' }],
      options: [
        { flags: '-l, --limit <n>', description: 'number of posts', default: 15 },
        { flags: '-t, --time <window>', description: 'hour|day|week|month|year|all', default: 'day' },
      ],
      async run(ctx) {
        const sub = ctx.args[0] ?? 'all';
        const posts = await listing(`/r/${sub}/top.json`, { limit: Number(ctx.opts.limit), t: String(ctx.opts.time) });
        return { data: posts, table: postTable(posts) };
      },
    },
    {
      name: 'new',
      description: 'Newest posts from a subreddit',
      args: [{ name: '[subreddit]', description: 'subreddit name, defaults to all' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of posts', default: 15 }],
      async run(ctx) {
        const sub = ctx.args[0] ?? 'all';
        const posts = await listing(`/r/${sub}/new.json`, { limit: Number(ctx.opts.limit) });
        return { data: posts, table: postTable(posts) };
      },
    },
    {
      name: 'search',
      description: 'Search posts across Reddit',
      args: [{ name: '<query>', description: 'search terms' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of results', default: 15 }],
      async run(ctx) {
        const q = encodeURIComponent(ctx.args[0]);
        const res = await getJSON<RedditListing>(
          `https://www.reddit.com/search.json?q=${q}&limit=${Number(ctx.opts.limit)}&raw_json=1`,
        );
        const posts = res.data.children.map(toPost);
        return { data: posts, table: postTable(posts) };
      },
    },
  ],
};
