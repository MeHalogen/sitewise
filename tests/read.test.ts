import { describe, expect, it } from 'vitest';
import { htmlToArticle } from '../src/read.js';

const ARTICLE_HTML = `<!DOCTYPE html>
<html><head><title>Test Article — Site</title></head>
<body>
<nav><a href="/">Home</a><a href="/about">About</a></nav>
<article>
  <h1>Test Article</h1>
  <p>${'This is the opening paragraph of a long-form article with enough substance for extraction. '.repeat(5)}</p>
  <h2>Section heading</h2>
  <p>${'More meaningful body content follows in the second paragraph, discussing the topic in depth. '.repeat(5)}</p>
  <pre><code>const x = 42;</code></pre>
</article>
<footer>Copyright</footer>
</body></html>`;

describe('htmlToArticle', () => {
  it('extracts title and body as markdown', () => {
    const article = htmlToArticle(ARTICLE_HTML, 'https://example.com/post');
    expect(article.title).toContain('Test Article');
    expect(article.markdown).toContain('## Section heading');
    expect(article.markdown).toContain('const x = 42;');
    expect(article.markdown).not.toContain('<p>');
  });

  it('throws on empty pages', () => {
    expect(() => htmlToArticle('<html><body></body></html>', 'https://example.com')).toThrow(/readable content/);
  });
});
