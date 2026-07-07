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

**51 sites** and counting. Run `webctl list` to see them all with their mode.

**API adapters** — instant, no browser, work anywhere (including CI):

| Category | Sites |
|----------|-------|
| Dev & packages | `github` `gitlab` `npm` `pypi` `crates` `stackoverflow` `devto` |
| News & knowledge | `hackernews` `reddit` `arxiv` `wikipedia` `wikidata` `rss` |
| Books & words | `openlibrary` `gutenberg` `dictionary` `urban` `words` `quotes` |
| Media | `itunes` `tvmaze` `anime` `musicbrainz` `rickandmorty` `pokemon` |
| Finance & crypto | `crypto` `coinpaprika` `coinlore` `defillama` `trending` `fx` |
| Food, world & fun | `cocktail` `meal` `brewery` `weather` `ip` `nasa` `worldtime` `art` `trivia` `joke` `lyrics` |

**Browser adapters** — run through your logged-in browser for sites with no usable API:

| Site | Commands |
|------|----------|
| `youtube` | `search` |
| `githubtrending` | `today` |
| `producthunt` | `today` |
| `lobsters` | `hot` |
| `steam` | `search` |
| `imdb` | `search` |
| `amazon` | `search` |
| `twitter` | `search`, `profile` *(needs login)* |
| `linkedin` | `search` *(needs login)* |

```bash
webctl npm search "web framework" -l 5
webctl github search "language:rust http server" -l 5
webctl arxiv recent cs.AI
webctl weather now "San Francisco"
webctl youtube search "rust async" -l 5
webctl twitter profile jack           # uses your logged-in X session
webctl list                           # everything, with mode (api/browser)
```

Every command supports `--json` for structured output.

### Write your own adapter (no engine code)

Browser adapters are just data: a URL, an optional wait selector, and a set of
CSS field selectors. Drop a YAML file in `~/.webctl/adapters/` and it shows up
in `webctl list`:

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
        url: { selector: a, attr: href }
```

Because it's plain data, selectors that drift can be fixed in seconds — and AI
agents can author new adapters through the MCP server.

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
