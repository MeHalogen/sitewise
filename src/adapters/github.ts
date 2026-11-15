import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';
import { timeAgo } from '../output.js';

const API = 'https://api.github.com';
const HEADERS = { accept: 'application/vnd.github+json' };

interface GhRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  pushed_at: string;
  open_issues_count: number;
}

interface GhRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  prerelease: boolean;
}

function toRepo(r: GhRepo) {
  return {
    name: r.full_name,
    description: r.description ?? '',
    stars: r.stargazers_count,
    language: r.language ?? '',
    url: r.html_url,
    pushedAt: r.pushed_at,
    openIssues: r.open_issues_count,
  };
}

const repoTable = (repos: ReturnType<typeof toRepo>[]) => ({
  columns: [
    { key: 'stars', header: 'Stars', align: 'right' as const },
    { key: 'name', header: 'Repo', maxWidth: 40 },
    { key: 'language', header: 'Lang' },
    { key: 'description', header: 'Description', maxWidth: 60 },
    { key: 'pushed', header: 'Pushed' },
  ],
  rows: repos.map((r) => ({ ...r, pushed: timeAgo(r.pushedAt) })),
});

export const github: Adapter = {
  name: 'github',
  description: 'GitHub — repo search, repo info, and releases (no auth needed)',
  commands: [
    {
      name: 'search',
      description: 'Search repositories, sorted by stars',
      example: ['mcp server'],
      args: [{ name: '<query>', description: 'search terms (supports GitHub qualifiers like language:rust)' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of results', default: 10 }],
      async run(ctx) {
        const q = encodeURIComponent(ctx.args[0]);
        const res = await getJSON<{ items: GhRepo[] }>(
          `${API}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Number(ctx.opts.limit)}`,
          HEADERS,
        );
        const repos = res.items.map(toRepo);
        return { data: repos, table: repoTable(repos) };
      },
    },
    {
      name: 'repo',
      description: 'Details for a single repository',
      example: ['nodejs/node'],
      args: [{ name: '<owner/repo>', description: 'e.g. facebook/react' }],
      async run(ctx) {
        const r = await getJSON<GhRepo>(`${API}/repos/${ctx.args[0]}`, HEADERS);
        const repo = toRepo(r);
        const text = [
          repo.name,
          repo.description,
          '',
          `Stars: ${repo.stars}   Language: ${repo.language || '—'}   Open issues: ${repo.openIssues}`,
          `Last push: ${timeAgo(repo.pushedAt)}`,
          repo.url,
        ].join('\n');
        return { data: repo, text };
      },
    },
    {
      name: 'releases',
      description: 'Recent releases of a repository',
      example: ['nodejs/node'],
      args: [{ name: '<owner/repo>', description: 'e.g. nodejs/node' }],
      options: [{ flags: '-l, --limit <n>', description: 'number of releases', default: 10 }],
      async run(ctx) {
        const releases = await getJSON<GhRelease[]>(
          `${API}/repos/${ctx.args[0]}/releases?per_page=${Number(ctx.opts.limit)}`,
          HEADERS,
        );
        const rows = releases.map((r) => ({
          tag: r.tag_name,
          name: r.name ?? '',
          prerelease: r.prerelease ? 'pre' : '',
          published: timeAgo(r.published_at),
          url: r.html_url,
        }));
        return {
          data: rows,
          table: {
            columns: [
              { key: 'tag', header: 'Tag' },
              { key: 'name', header: 'Name', maxWidth: 40 },
              { key: 'prerelease', header: '' },
              { key: 'published', header: 'Published' },
            ],
            rows,
          },
        };
      },
    },
  ],
};
