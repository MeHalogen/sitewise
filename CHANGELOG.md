# Changelog

All notable changes to sitewise are documented here. This project follows
[Semantic Versioning](https://semver.org).

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
