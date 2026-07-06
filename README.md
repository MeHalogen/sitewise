# webctl

> **Control the web from your terminal.**
> Sites as commands. Browser automation without an extension. A native MCP server for AI agents.

```bash
webctl hackernews top --limit 5
webctl reddit hot programming
webctl read https://any-article.com --json
webctl browser goto github.com
```

## Why webctl

- **Zero setup.** `npm i -g webctl` and the core commands work immediately — no extension, no daemon, no account. Works on servers and in CI.
- **Agent-native.** `webctl mcp` runs a full MCP server over stdio. Add it to Claude Code or Cursor and your agent gets site commands, article extraction, and browser control as first-class tools.
- **Real browser control when you need it.** `webctl browser` drives a Chrome-family browser directly over the DevTools protocol — navigate, click, fill, extract, screenshot — using a dedicated profile where your logins persist.
- **Human and machine output.** Beautiful tables in a terminal; clean JSON with `--json` or whenever output is piped.

## Install

Requires Node.js >= 20.

```bash
npm install -g webctl
webctl doctor
```

## Site commands

| Site | Commands |
|------|----------|
| `hackernews` | `top`, `new`, `search` |
| `reddit` | `hot`, `top`, `new`, `search` |
| `github` | `search`, `repo`, `releases` |
| `arxiv` | `search`, `recent`, `abstract` |
| `wikipedia` | `summary`, `search` |
| `crypto` | `top`, `price` |
| `weather` | `now` |
| `rss` | `read` (any RSS/Atom feed) |

```bash
webctl github search "language:rust http server" -l 5
webctl arxiv recent cs.AI
webctl weather now "San Francisco"
webctl rss read https://blog.rust-lang.org/feed.xml
webctl list          # everything, including future adapters
```

Every command supports `--json` for structured output.

## Read anything as Markdown

```bash
webctl read https://example.com/some-article
```

Extracts the main article (title, byline, body) and prints clean Markdown. Great for piping into an LLM.

## Browser control

```bash
webctl browser start                 # launches Chrome with a dedicated webctl profile
webctl browser goto news.ycombinator.com
webctl browser text                  # visible text of the page
webctl browser read                  # main article as Markdown
webctl browser click 'a.morelink'
webctl browser fill 'input[name=q]' "query"
webctl browser screenshot -o page.png
webctl browser tabs                  # list tabs; target one with -t <index|substring>
```

Log in to sites once in the webctl browser window — sessions persist in `~/.webctl/browser-profile`.

## For AI agents (MCP)

Add webctl as an MCP server:

```bash
claude mcp add webctl -- webctl mcp
```

The agent gets tools for listing/running site commands (`run_command`), reading URLs as Markdown (`read_url`), and full browser control (`browser_goto`, `browser_click`, `browser_fill`, `browser_text`, `browser_read`, `browser_eval`).

## License

Proprietary — see [LICENSE](./LICENSE).
