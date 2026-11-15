/**
 * Recognise a bot check / block page (Cloudflare, AWS WAF, Reddit, …) so we can
 * say so plainly instead of reporting "no data", and never try to "heal"
 * selectors against it. sitewise does not attempt to get past these pages.
 */
const TITLE_PATTERNS = [
  /just a moment/i,
  /attention required/i,
  /access denied/i,
  /^\s*403 forbidden/i,
  /prove your humanity/i,
  /are you a robot/i,
  /captcha/i,
  /verify you are human/i,
  /blocked/i,
];

const BODY_PATTERNS = [/cf-chl-|challenge-platform/i, /captcha-delivery|geo\.captcha/i, /awswaf/i];

/** Phrases block pages show; only checked when the page has little visible text. */
const TEXT_PATTERNS = [
  /blocked by network security/i,
  /you(?:'|’)ve been blocked/i,
  /unusual traffic from your (?:computer|network)/i,
  /verify (?:that )?you are (?:a )?human/i,
  /enable javascript and cookies to continue/i,
  /access to this page has been denied/i,
];

/** The page's visible text (scripts, styles and tags removed). */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class BotWallError extends Error {
  constructor(
    public readonly host: string,
    public readonly pageTitle: string,
  ) {
    super(
      `${host} showed a bot check${pageTitle.trim() ? ` ("${pageTitle.trim().slice(0, 60)}")` : ''} instead of the page. ` +
        `Run \`sitewise browser start\`, open ${host} in that window and complete it once; ` +
        `headless and server environments are often blocked outright.`,
    );
    this.name = 'BotWallError';
  }
}

export function pageTitle(html: string): string {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

export function looksLikeBotWall(html: string): boolean {
  const title = pageTitle(html);
  if (title && TITLE_PATTERNS.some((p) => p.test(title))) return true;
  // Challenge pages are small; real pages that merely mention captcha are large.
  if (html.length < 60_000 && BODY_PATTERNS.some((p) => p.test(html))) return true;
  // Some block pages have no title and inline large images, but say very little.
  const text = visibleText(html);
  return text.length < 1_500 && TEXT_PATTERNS.some((p) => p.test(text));
}
