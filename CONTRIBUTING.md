# Contributing to sitewise

Thanks for helping. The most useful contributions are **new sites** and
**fixes for broken ones**, and both are usually a few lines of data, not code.

## Add a site in ten lines

### A site with a public JSON API (preferred)

Add an entry to `src/api/specs.ts`:

```ts
{
  name: 'crates',
  description: 'crates.io — Rust package search',
  commands: [
    {
      name: 'search',
      description: 'Search crates',
      example: ['serde'],
      url: 'https://crates.io/api/v1/crates?q={query}&per_page={limit}',
      maxLimit: 100,
      root: 'crates',
      args: [{ name: '<query>', description: 'search terms' }],
      item: { name: 'name', version: 'max_stable_version', downloads: 'downloads' },
    },
  ],
},
```

- `url`: `{query}` is all arguments joined, `{0}` `{1}` are positional, `{0|all}`
  gives a default, `{limit}` is the requested row count.
- `root`: dot path to the array in the response; `item`: output field → dot path.
- `example`: arguments used by `--help` and by the health check. Required if the
  command takes a required argument.
- Only endpoints that need **no API key** (or have an optional one, like `nasa`).

### A site without an API: a browser adapter

Write YAML, try it locally, then add the same spec to `src/adapters/web/specs.ts`:

```yaml
# ~/.sitewise/adapters/lobsters.yaml
name: lobsters
description: "[browser] Lobste.rs — front page"
commands:
  - name: hot
    description: Front-page stories
    url: https://lobste.rs/
    example: []
    list:
      selector: .story
      fields:
        title: { selector: .link a.u-url }
        url: { selector: .link a.u-url, attr: href, absolute: true }
```

`sitewise lobsters hot` picks it up immediately. If you have an LLM key,
`sitewise author <site> <command> <url> --want title,url` will draft one for you
and verify it against the live page.

## Before you open a PR

```bash
npm install
npm run typecheck
npm test
sitewise doctor --adapters --only <your-site>          # API adapters
SITEWISE_HEADLESS=1 npm run dev -- doctor --adapters --browser --only <your-site>
```

## Rules for adapters

- Read only public data, or the user's own logged-in session in the sitewise
  browser. Never ship credentials.
- Identify as sitewise. No user-agent spoofing, and no getting past bot checks
  or captchas: if a site blocks automated clients, it is not a good fit.
- Respect documented rate limits and API etiquette (some APIs ask for an
  identifying header, as `art` does).

## Reporting a broken site

When a command fails, sitewise prints a prefilled issue link. Or use the
[broken adapter form](https://github.com/MeHalogen/sitewise/issues/new?template=broken-adapter.yml).
The nightly canary also opens issues for sites that stop working.
