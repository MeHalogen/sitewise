# sitewise

> **Give your AI agent the web, as tools that return clean JSON.**
> 50 sites as deterministic commands, browser control, and a native MCP server. Also a great CLI.

[![npm version](https://img.shields.io/npm/v/sitewise?color=cb3837&logo=npm)](https://www.npmjs.com/package/sitewise)
[![adapter health](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/MeHalogen/sitewise/status/badge.json)](https://github.com/MeHalogen/sitewise/blob/status/status.json)
[![ci](https://github.com/MeHalogen/sitewise/actions/workflows/ci.yml/badge.svg)](https://github.com/MeHalogen/sitewise/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/sitewise?color=blue)](./LICENSE)

**Add it to Claude Code in one line, nothing to install:**

```bash
claude mcp add sitewise -- npx -y sitewise mcp
```

Your agent can now search GitHub, npm, arXiv, Hacker News, Stack Overflow, Wikipedia and 40+ more sites, read any article as Markdown, and drive a real browser, all as structured tool calls instead of screen-scraping.

![sitewise demo](https://raw.githubusercontent.com/MeHalogen/sitewise/main/demo.gif)

```bash
sitewise hackernews top
sitewise github search "language:rust cli"
sitewise weather now "San Francisco"
sitewise read https://some-article.com
```

---

## What is sitewise?

One clean surface over the web, three ways:

1. **A native MCP server.** `sitewise mcp` exposes everything below as tools for AI agents (Claude Code, Cursor, or any MCP client). Every tool returns structured JSON, and `list_commands` tells the agent each command's arguments and options, so it calls correctly the first time.
2. **Site commands.** 40 sites over their public APIs: no keys, no browser, no setup. `sitewise hackernews top` just works, even on a server or in CI.
3. **Browser automation.** Drive a real Chrome-family browser over the DevTools Protocol (no extension), with a persistent profile where your logins stick. This also powers adapters for sites without a usable API.

Human output is tables; machine output is JSON with `--json` (or automatically when piped).

### It tells you when a site breaks, and fixes what it can

Websites change. sitewise is built to notice:

- **Live health, in public.** A nightly canary runs every adapter and publishes the result: that is the badge above ([full report](https://github.com/MeHalogen/sitewise/blob/status/status.json)). A broken adapter gets an issue automatically, which closes itself when it recovers.
- **Check it yourself.** `sitewise doctor --adapters` runs every command's example and prints a health table.
- **Self-repair.** When a browser adapter's selectors drift and you have an `ANTHROPIC_API_KEY`, sitewise repairs them inline, verifies the fix against the live page, and saves it. Unverified repairs are never saved.
- **Errors that say what to do.** A failure explains itself in plain words (rate-limited, blocked, down) and prints a prefilled issue link. Nothing is sent unless you submit it; sitewise has no telemetry.

---

## Install

Requires **Node.js ≥ 20**. For agents, the `npx` line above is all you need. For the CLI:

```bash
npm install -g sitewise
sitewise doctor              # verifies node, network, and browser
sitewise doctor --adapters   # checks every site
```

## Quick start

```bash
sitewise list                          # every site + command, with its mode
sitewise hackernews top --limit 5
sitewise npm search "web framework" --limit 50
sitewise crypto top
sitewise read https://example.com/post # any article → clean Markdown
sitewise npm search --help             # every command shows an example
```

Every command takes `--json` for structured output and `--limit <n>` where it applies (the limit is passed to the site's API, so you get the rows you asked for).

---

## Site commands

**50 sites, 64 commands.** Two kinds:

### API adapters: instant, no browser, work anywhere (40 sites)

| Category | Sites |
|----------|-------|
| **Dev & packages** | `github` · `gitlab` · `npm` · `pypi` · `crates` · `stackoverflow` · `devto` |
| **News & knowledge** | `hackernews` · `arxiv` · `wikipedia` · `wikidata` · `rss` |
| **Books & words** | `openlibrary` · `dictionary` · `urban` · `words` · `quotes` |
| **Media** | `itunes` · `tvmaze` · `anime` · `musicbrainz` · `rickandmorty` · `pokemon` |
| **Finance & crypto** | `crypto` · `coinpaprika` · `coinlore` · `defillama` · `trending` · `fx` |
| **Food, world & fun** | `cocktail` · `meal` · `brewery` · `weather` · `ip` · `nasa` · `worldtime` · `art` · `trivia` · `joke` · `lyrics` |

`nasa` uses NASA's shared `DEMO_KEY`, which is often rate-limited; set `NASA_API_KEY` ([free](https://api.nasa.gov)) for reliable use.

### Browser adapters: run through your own browser (10 sites)

| Site | Commands | Login |
|------|----------|-------|
| `youtube` | `search` | no |
| `githubtrending` | `today` | no |
| `producthunt` | `today` | no |
| `lobsters` | `hot` | no |
| `steam` | `search` | no |
| `imdb` | `search` | no |
| `amazon` | `search` | no |
| `reddit` | `hot`, `new`, `top`, `search` | **yes** · experimental |
| `twitter` | `search`, `profile` | **yes** · experimental |
| `linkedin` | `search` | **yes** · experimental |

*Experimental* adapters need you to log in once in the sitewise browser (`sitewise browser start`), and their selectors have not yet been verified against a logged-in session. Some sites show a bot check to automated or headless browsers; sitewise says so plainly and never tries to get past one.

```bash
sitewise arxiv recent cs.AI
sitewise stackoverflow search "async rust"
sitewise youtube search "svelte 5" --limit 5
sitewise reddit top programming --time week   # uses your logged-in session
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

sitewise is an MCP server out of the box. Claude Code, with nothing installed:

```bash
claude mcp add sitewise -- npx -y sitewise mcp
```

If you installed it globally: `claude mcp add -s user sitewise -- sitewise mcp`. For any other MCP client, run the command `npx -y sitewise mcp` over stdio.

Your agent then gets these tools:

| Tool | What it does |
|------|--------------|
| `list_commands` | every site command with its arguments, options, defaults and an example |
| `run_command` | run any site command with `args` and any of its `options` (e.g. `{"time": "week"}`); returns JSON |
| `read_url` | fetch a URL as clean Markdown |
| `author_adapter` | create a new adapter from selectors the agent found (verified against the live page before saving) |
| `browser_start` / `browser_tabs` | launch and inspect the browser |
| `browser_goto` / `browser_read` / `browser_text` | navigate and extract |
| `browser_click` / `browser_fill` / `browser_eval` | interact with pages |

The API tools work immediately with no browser; the `browser_*` tools launch the managed browser on first use.

## Intelligence & habit features

Powerful without a key; even better with one. The LLM-backed commands (`heal`,
`ask`, `author`) use the official Anthropic SDK — set `ANTHROPIC_API_KEY`
(model via `SITEWISE_LLM_MODEL`), or run via MCP so
your agent supplies the intelligence. Everything else needs no key.

**Self-healing adapters.** When a browser adapter stops returning data, an
LLM proposes new selectors; sitewise *verifies them against the live page* and
only saves the fix if it actually extracts data. With a key set this happens
automatically, mid-command (turn it off with `SITEWISE_AUTOHEAL=0`); you can
also run it by hand:

```bash
sitewise heal producthunt today       # repair a broken adapter, save the fix
```

**Ask in plain English.**

```bash
sitewise ask "top hacker news stories"
sitewise ask "cheapest usb-c cable on amazon" --dry-run
```

**Author a new site — no code.**

```bash
sitewise author mysite list https://mysite.com --want title,price,url
```

**Your daily briefing.**

```bash
sitewise dash init --city "San Francisco"
sitewise dash                          # HN + weather + crypto + DEV, one command
```

**Watch the web; get pinged anywhere.**

```bash
sitewise watch add crypto price bitcoin --field price --below 60000 --webhook <slack-url>
sitewise watch add hackernews top      # notify when the top story changes
sitewise watch daemon                  # keep checking on an interval
```

**Keep a local data trail.**

```bash
export SITEWISE_HISTORY=1              # capture every run to ~/.sitewise/history
sitewise history crypto top --grep bitcoin
```

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

- `{query}` in a `url` is replaced by the command's arguments; `{0}`, `{1}` are positional, and `{0|all}` gives a default.
- `{limit}` is the requested row count; any option you declare under `options:` fills `{its-name}`.
- `example: [rust]` gives the arguments shown in `--help` and used by `sitewise doctor --adapters`.
- `attr` reads an attribute (e.g. `href`) instead of text; `absolute: true` resolves relative URLs.
- No `selector` on a field means "use the matched item element itself."

Because adapters are data, a selector that drifts is a one-line fix — and an AI agent can author new adapters through the MCP server.

---

## Environment variables

| Variable | Effect |
|----------|--------|
| `ANTHROPIC_API_KEY` | enables `ask`, `author`, `heal` and inline auto-heal |
| `SITEWISE_LLM_MODEL` | model for those features |
| `SITEWISE_AUTOHEAL=0` | turn off inline auto-heal |
| `SITEWISE_HEADLESS=1` | run the managed browser without a window (servers, CI) |
| `SITEWISE_HISTORY=1` | record every run to `~/.sitewise/history` |
| `NASA_API_KEY` | your own key for `nasa apod` |

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

Contributions welcome. A new site is usually ten lines of data: see [CONTRIBUTING.md](./CONTRIBUTING.md). Found a broken site? [Open an issue](https://github.com/MeHalogen/sitewise/issues/new/choose); the CLI prints a prefilled link when a command fails.

---

## License

[MIT](./LICENSE) © Mehal Srivastava
