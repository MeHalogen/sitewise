# Changelog

All notable changes to sitewise are documented here. This project follows
[Semantic Versioning](https://semver.org).

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
