# Changelog

All notable changes to sitewise are documented here. This project follows
[Semantic Versioning](https://semver.org).

## [1.3.1] — 2026-11-25

A security patch. `npm audit` now reports 0 vulnerabilities (1.3.0 had 18,
several in runtime dependencies).

### Security

- Upgraded `@modelcontextprotocol/sdk` (1.32.2), `fast-xml-parser` (5.12.1),
  `js-yaml` (4.3.2) and transitive dependencies to patched versions, and
  raised the minimum versions so installs cannot resolve vulnerable ones.
- Moved to `zod` 4 (GHSA-mrhx-c7xc-m3w5: memory exhaustion while validating
  oversized collections). MCP tool inputs are also capped explicitly: at most
  20 positional args, 50 coins, and bounded string lengths.

## [1.3.0] — 2026-11-15

The reliability release: sitewise now tells you when a site breaks, repairs
what it can, and every command does what its flags say.

### Added

- **Dedicated MCP tools for agents**: `search_github`, `get_github_repo`,
  `get_github_releases`, `search_npm`, `get_pypi_package`, `search_crates`,
  `search_stackoverflow`, `hacker_news`, `search_arxiv`, `latest_arxiv_papers`,
  `wikipedia_summary`, `get_weather`, `get_crypto_prices` and
  `convert_currency`. Each description says when it beats a general web
  search; results are compact JSON (or a short summary for single items).
  The server now sends instructions on when to use sitewise, data tools are
  annotated read-only, and failures are returned as MCP errors.
- **`sitewise doctor --adapters`**: runs every command's example and prints a
  health table (`--json`, `--browser`, `--only <sites>`, `--badge <file>`).
- **Nightly canary**: a GitHub Action checks every adapter, publishes the
  result and a live health badge, and opens (and later closes) one issue per
  broken adapter.
- **Inline auto-heal**: when a browser adapter returns nothing and
  `ANTHROPIC_API_KEY` is set, its selectors are repaired and verified mid-run.
  Opt out with `SITEWISE_AUTOHEAL=0`.
- **MCP `run_command` takes `options`** (e.g. `{"time": "week"}`), validated
  against the command; `list_commands` now returns each command's arguments,
  options, defaults and an example.
- **Examples on every command**, shown under `--help`.
- **Prefilled issue links** when a command fails (nothing is sent unless you
  submit it; there is no telemetry), plus issue forms for broken adapters and
  site requests.
- `SITEWISE_HEADLESS=1` runs the managed browser without a window.
- Windows desktop notifications; Microsoft Edge is used when Chrome is absent.
- `NASA_API_KEY` for `nasa apod`.

### Changed

- **`reddit` moved to the browser engine** and runs in your own logged-in
  session (Reddit now refuses its JSON API to non-browser clients). It is
  marked experimental, as are `twitter` and `linkedin`, until their selectors
  are verified against a logged-in session.
- Network errors explain themselves (rate-limited, blocked, down, unreachable)
  and say what to do next; 429, 5xx and timeouts are retried once.
- Pages that show a bot check now fail with a plain explanation instead of
  returning no data. sitewise does not try to get past them.
- The version comes from `package.json` everywhere (CLI, MCP, user-agent).

### Fixed

- `ask` ran code adapters with `limit=NaN`; every non-CLI path (ask, dash,
  watch, MCP) now applies command defaults the same way.
- `--limit` above 20 silently returned 20 rows for 18 API commands; the limit
  now reaches the API (capped at each API's own maximum).
- `art` returned 403; it now sends the identifying header the Art Institute's
  API asks for.
- Watch notifications on Linux and macOS passed web text through a shell; all
  platforms now pass it as plain arguments.

### Removed

- `gutenberg`: the Gutendex API no longer responds. Use `openlibrary`.

## [1.2.0] — 2026-07-26

The intelligence + engagement release — features that make sitewise a daily
habit and keep it from breaking.

### Added

- **Self-healing adapters** (`sitewise heal <site> <command>`) — when a browser
  adapter stops returning data, an LLM proposes new selectors; sitewise
  **verifies them against the live DOM** and only saves the fix if it actually
  extracts data, so a bad repair can never land.
- **Natural-language `ask`** (`sitewise ask "weather in Tokyo"`) — routes plain
  English to the right command. The model only chooses from the real catalog;
  its choice is validated before running.
- **Agent-authored adapters** (`sitewise author <site> <command> <url>
  --want …`, and the `author_adapter` MCP tool) — create a new adapter for any
  site; selectors are verified against the live page before saving.
- **Personal dashboard** (`sitewise dash`) — one command renders your
  configured feeds as a stacked briefing. `dash init/add/remove/list`.
- **Watches** (`sitewise watch add …`) — watch any command for a change or a
  numeric threshold; get desktop notifications, and optionally POST to a
  Slack/Discord/generic webhook (`--webhook`). Edge-triggered, with a `daemon`.
- **Local data trail** (`sitewise history`, opt-in `SITEWISE_HISTORY=1`) —
  every run appends its rows to `~/.sitewise/history` as JSONL.

The intelligent features use the official Anthropic SDK (bring your own
`ANTHROPIC_API_KEY`, or run via MCP so the agent supplies the intelligence);
everything else needs no key. No native dependencies.

## [1.0.0] — 2026-07-08

Initial public release.

### Added

- **51 sites / 65 commands** across two adapter engines.
- **API adapters** over no-key public JSON endpoints (dev, news, books,
  media, finance, food, and more) — instant, no browser required, work in CI.
- **Browser adapters** that drive a Chrome-family browser over the DevTools
  protocol (no extension needed): YouTube, GitHub Trending, Product Hunt,
  Lobsters, Steam, IMDb, Amazon, plus logged-in Twitter/X and LinkedIn.
- **Declarative adapter formats** — add a site as plain data (a spec object or
  a `~/.sitewise/adapters/*.yaml` file); no engine code.
- **`sitewise read <url>`** — extract any article to clean Markdown.
- **`sitewise mcp`** — native MCP server exposing every command, article
  extraction, and browser control as tools for Claude Code, Cursor, and other
  agents.
- **`sitewise browser`** — navigate, click, fill, extract, and screenshot a
  persistent, logged-in browser profile.
- Human-friendly tables with `--json` output everywhere for machines.
- `sitewise doctor` health checks.
