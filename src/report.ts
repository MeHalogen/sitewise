import { VERSION } from './version.js';

export const REPO_URL = 'https://github.com/MeHalogen/sitewise';

/**
 * A prefilled "broken adapter" issue link. Nothing is sent anywhere: the user
 * opens the link, reads what will be filed, and submits it themselves.
 */
export function reportUrl(site: string, command: string, error: string, args: string[] = []): string {
  const body = [
    `**Command:** \`sitewise ${[site, command, ...args].join(' ')}\``,
    `**Version:** ${VERSION}`,
    `**Platform:** ${process.platform} / Node ${process.versions.node}`,
    '',
    '**Error:**',
    '```',
    error.slice(0, 1500),
    '```',
  ].join('\n');
  const params = new URLSearchParams({
    template: 'broken-adapter.yml',
    title: `[broken] ${site} ${command}`,
    labels: 'broken-adapter',
    site,
    command,
    version: VERSION,
    error: error.slice(0, 1500),
    body,
  });
  return `${REPO_URL}/issues/new?${params}`;
}
