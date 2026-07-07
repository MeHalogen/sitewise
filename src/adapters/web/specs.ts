import type { BrowserAdapterSpec } from '../../browser/declarative.js';

/**
 * Built-in browser adapters, shipped as declarative specs. Each command
 * navigates a URL, optionally waits for a selector, then extracts rows.
 *
 * Selectors on large sites drift over time; `webctl <site> <cmd>` re-reads the
 * live DOM every run, and specs are plain data so they (or user overrides in
 * ~/.webctl/adapters/*.yaml) can be fixed without touching engine code.
 */
export const builtinBrowserAdapters: BrowserAdapterSpec[] = [
  {
    name: 'producthunt',
    description: '[browser] Product Hunt — today\'s launches',
    commands: [
      {
        name: 'today',
        description: "Today's top products",
        url: 'https://www.producthunt.com/',
        waitFor: '[data-test^="post-item"]',
        columns: ['name', 'tagline', 'votes'],
        list: {
          selector: '[data-test^="post-item"]',
          limit: 20,
          fields: {
            name: { selector: '[data-test="post-name"]' },
            tagline: { selector: '[data-test="post-name"] + *' },
            votes: { selector: '[data-test="vote-button"]' },
            url: { selector: 'a[data-test="post-name"]', attr: 'href' },
          },
        },
      },
    ],
  },
  {
    name: 'lobsters',
    description: '[browser] Lobste.rs — tech link aggregator (no login)',
    commands: [
      {
        name: 'hot',
        description: 'Front-page stories',
        url: 'https://lobste.rs/',
        waitFor: '.story',
        columns: ['score', 'title', 'tag', 'comments'],
        list: {
          selector: '.story',
          limit: 25,
          fields: {
            score: { selector: '.voters' },
            title: { selector: '.link a.u-url' },
            url: { selector: '.link a.u-url', attr: 'href' },
            tag: { selector: '.tags .tag' },
            comments: { selector: '.mobile_comments, .comments_label a' },
          },
        },
      },
    ],
  },
  {
    name: 'youtube',
    description: '[browser] YouTube — search results',
    commands: [
      {
        name: 'search',
        description: 'Search videos',
        url: 'https://www.youtube.com/results?search_query={query}',
        waitFor: 'ytd-video-renderer',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['title', 'channel', 'meta'],
        list: {
          selector: 'ytd-video-renderer',
          limit: 20,
          fields: {
            title: { selector: '#video-title' },
            url: { selector: '#video-title', attr: 'href' },
            channel: { selector: 'ytd-channel-name a' },
            meta: { selector: '#metadata-line' },
          },
        },
      },
    ],
  },
  {
    name: 'twitter',
    description: '[browser] Twitter/X — uses your logged-in session',
    commands: [
      {
        name: 'search',
        description: 'Search recent tweets (requires being logged in)',
        url: 'https://x.com/search?q={query}&f=live',
        waitFor: 'article[data-testid="tweet"]',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['author', 'text'],
        list: {
          selector: 'article[data-testid="tweet"]',
          limit: 20,
          fields: {
            author: { selector: 'div[data-testid="User-Name"]' },
            text: { selector: 'div[data-testid="tweetText"]' },
            time: { selector: 'time', attr: 'datetime' },
          },
        },
      },
      {
        name: 'profile',
        description: "A user's recent tweets",
        url: 'https://x.com/{0}',
        waitFor: 'article[data-testid="tweet"]',
        args: [{ name: '<handle>', description: 'username without @' }],
        columns: ['author', 'text'],
        list: {
          selector: 'article[data-testid="tweet"]',
          limit: 20,
          fields: {
            author: { selector: 'div[data-testid="User-Name"]' },
            text: { selector: 'div[data-testid="tweetText"]' },
            time: { selector: 'time', attr: 'datetime' },
          },
        },
      },
    ],
  },
  {
    name: 'linkedin',
    description: '[browser] LinkedIn — uses your logged-in session',
    commands: [
      {
        name: 'search',
        description: 'Search posts (requires being logged in)',
        url: 'https://www.linkedin.com/search/results/content/?keywords={query}',
        waitFor: '.update-components-text',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['author', 'text'],
        list: {
          selector: 'div.feed-shared-update-v2',
          limit: 15,
          fields: {
            author: { selector: '.update-components-actor__title' },
            text: { selector: '.update-components-text' },
          },
        },
      },
    ],
  },
  {
    name: 'amazon',
    description: '[browser] Amazon — product search',
    commands: [
      {
        name: 'search',
        description: 'Search products',
        url: 'https://www.amazon.com/s?k={query}',
        waitFor: 'div[data-component-type="s-search-result"]',
        args: [{ name: '<query>', description: 'search terms' }],
        columns: ['title', 'price', 'rating'],
        list: {
          selector: 'div[data-component-type="s-search-result"]',
          limit: 20,
          fields: {
            title: { selector: 'h2 span' },
            url: { selector: 'h2 a', attr: 'href' },
            price: { selector: '.a-price .a-offscreen' },
            rating: { selector: '.a-icon-alt' },
          },
        },
      },
    ],
  },
];
