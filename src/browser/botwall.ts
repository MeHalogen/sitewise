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

export class BotWallError extends Error {
  constructor(
    public readonly host: string,
    public readonly pageTitle: string,
  ) {
    super(
      `${host} showed a bot check ("${pageTitle.trim().slice(0, 60)}") instead of the page. ` +
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
  return html.length < 60_000 && BODY_PATTERNS.some((p) => p.test(html));
}
