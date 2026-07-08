# sitewise

> **Control the web from your terminal.**
> Turn any website into a deterministic command — for you, and for your AI agents.

[![npm version](https://img.shields.io/npm/v/sitewise?color=cb3837&logo=npm)](https://www.npmjs.com/package/sitewise)
[![license](https://img.shields.io/npm/l/sitewise?color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/sitewise)](https://nodejs.org)

![sitewise demo](https://raw.githubusercontent.com/MeHalogen/sitewise/main/demo.gif)

```bash
sitewise hackernews top
sitewise github search "language:rust cli"
sitewise weather now "San Francisco"
sitewise read https://some-article.com
```

---

## What is sitewise?

sitewise gives you one clean surface over the web — three ways:

1. **Site commands** — 40+ sites exposed as commands over their public APIs. No keys, no browser, no setup. `sitewise hackernews top` just works, even on a server or in CI.
2. **Browser automation** — drive a real Chrome-family browser over the DevTools Protocol (no extension). Navigate, click, fill, extract, screenshot — using a persistent profile where your logins stick. This also powers adapters for sites with no usable API.
3. **A native MCP server** — `sitewise mcp` exposes everything above as tools for AI agents (Claude Code, Cursor, or any MCP client), so your agent gets **structured, deterministic** web access instead of screen-scraping.

Human output is pretty tables; machine output is clean JSON with `--json` (or automatically when piped).

---

## Install

Requires **Node.js ≥ 20**.

```bash
npm install -g sitewise
sitewise doctor      # verifies node, network, and browser
```

## Quick start

```bash
sitewise list                          # every site + command, with its mode
sitewise hackernews top --limit 5
sitewise npm search "web framework"
sitewise crypto top
sitewise read https://example.com/post # any article → clean Markdown
```

Every command takes `--json` for structured output and `--limit <n>` where it applies.

---

## Site commands

**51 sites, 65 commands.** Two kinds:

### API adapters — instant, no browser, work anywhere

| Category | Sites |
|----------|-------|
| **Dev & packages** | `github` · `gitlab` · `npm` · `pypi` · `crates` · `stackoverflow` · `devto` |
| **News & knowledge** | `hackernews` · `reddit` · `arxiv` · `wikipedia` · `wikidata` · `rss` |
| **Books & words** | `openlibrary` · `gutenberg` · `dictionary` · `urban` · `words` · `quotes` |
| **Media** | `itunes` · `tvmaze` · `anime` · `musicbrainz` · `rickandmorty` · `pokemon` |
| **Finance & crypto** | `crypto` · `coinpaprika` · `coinlore` · `defillama` · `trending` · `fx` |
| **Food, world & fun** | `cocktail` · `meal` · `brewery` · `weather` · `ip` · `nasa` · `worldtime` · `art` · `trivia` · `joke` · `lyrics` |

### Browser adapters — run through your (logged-in) browser

| Site | Commands | Login |
|------|----------|-------|
| `youtube` | `search` | no |
| `githubtrending` | `today` | no |
| `producthunt` | `today` | no |
| `lobsters` | `hot` | no |
| `steam` | `search` | no |
| `imdb` | `search` | no |
| `amazon` | `search` | no |
| `twitter` | `search`, `profile` | **yes** |
| `linkedin` | `search` | **yes** |

```bash
sitewise arxiv recent cs.AI
sitewise stackoverflow search "async rust"
sitewise youtube search "svelte 5" --limit 5
sitewise twitter profile jack          # uses your logged-in X session
```

Run `sitewise list` to see them all, each tagged `api` or `browser`.

---

## Read any page as Markdown

```bash
sitewise read https://example.com/some-article
```

Extracts the main article (title, byline, body) and prints clean Markdown — perfect for piping into an LLM or saving notes. Add `--json` for structured fields.

---

## Browser control

sitewise launches and drives a dedicated Chrome-family browser (Chrome, Chromium, Brave, or Edge) over the DevTools Protocol. It uses its own profile at `~/.sitewise/browser-profile`, so it never touches your everyday browser — **log into a site once there and the session persists** across runs.

```bash
sitewise browser start                 # launch the managed browser
sitewise browser goto news.ycombinator.com
sitewise browser text                  # visible text of the page
sitewise browser read                  # main article as Markdown
sitewise browser click 'a.morelink'
sitewise browser fill 'input[name=q]' "query"
sitewise browser eval "document.title"
sitewise browser screenshot -o page.png
sitewise browser tabs                  # list tabs; target one with -t <index|substring>
```

---

## For AI agents (MCP)

sitewise is an MCP server out of the box. Add it to Claude Code:

```bash
claude mcp add -s user sitewise -- sitewise mcp
```

(Or point any MCP client at the command `sitewise mcp`.)

Your agent then gets these tools:

| Tool | What it does |
|------|--------------|
| `list_commands` | discover every available site command |
| `run_command` | run any site command, returns structured JSON |
| `read_url` | fetch a URL as clean Markdown |
| `browser_start` / `browser_tabs` | launch and inspect the browser |
| `browser_goto` / `browser_read` / `browser_text` | navigate and extract |
| `browser_click` / `browser_fill` / `browser_eval` | interact with pages |

The API tools work immediately with no browser; the `browser_*` tools launch the managed browser on first use.

---

## Write your own adapter — no code

Adapters are **plain data**. Drop a YAML file into `~/.sitewise/adapters/` and it shows up in `sitewise list`.

A browser adapter is a URL, an optional wait selector, and CSS field selectors:

```yaml
name: news
description: "[browser] Example news site"
commands:
  - name: top
    description: Top headlines
    url: https://example.com/news
    waitFor: article.story
    columns: [headline, section]
    list:
      selector: article.story
      limit: 20
      fields:
        headline: { selector: h2 }
        section: { selector: .section }
        url: { selector: a, attr: href, absolute: true }
```

- `{query}` in a `url` is replaced by the command's arguments; `{0}`, `{1}` are positional.
- `attr` reads an attribute (e.g. `href`) instead of text; `absolute: true` resolves relative URLs.
- No `selector` on a field means "use the matched item element itself."

Because adapters are data, a selector that drifts is a one-line fix — and an AI agent can author new adapters through the MCP server.

---

## Scripting & JSON

Output switches to JSON automatically when piped, or force it with `--json`:

```bash
sitewise crypto top --json | jq '.[0].symbol'
sitewise github search "stars:>10000 language:go" --json > repos.json
```

---

## How it works

Two small, declarative engines share one output layer:

- **API engine** — fetches a no-key JSON endpoint and maps it to rows via dot-paths.
- **Browser engine** — connects to the DevTools Protocol, opens a throwaway tab, waits for content, and runs a dependency-free extractor injected into the page (the same extractor is unit-tested against real DOM).

Adding a site touches **data, not engine code** — which is why the library grows fast and stays maintainable.

---

## Development

```bash
git clone https://github.com/MeHalogen/sitewise
cd sitewise
npm install
npm run dev -- hackernews top     # run from source
npm test                          # unit tests
npm run build                     # compile to dist/
```

Contributions welcome — new adapters are especially easy (see above).

---

## License

[MIT](./LICENSE) © Mehal Srivastava
