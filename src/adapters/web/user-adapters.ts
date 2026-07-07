import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import type { BrowserAdapterSpec } from '../../browser/declarative.js';

export function userAdapterDir(): string {
  return path.join(homedir(), '.sitewise', 'adapters');
}

function isValidSpec(spec: unknown): spec is BrowserAdapterSpec {
  if (!spec || typeof spec !== 'object') return false;
  const s = spec as Record<string, unknown>;
  return typeof s.name === 'string' && Array.isArray(s.commands);
}

/**
 * Load user/community/agent-authored browser adapters from
 * ~/.sitewise/adapters/*.yaml. Malformed files are skipped, not fatal, so one
 * bad adapter never takes down the CLI.
 */
export function loadUserAdapterSpecs(): BrowserAdapterSpec[] {
  let files: string[];
  try {
    files = readdirSync(userAdapterDir()).filter((f) => /\.(ya?ml)$/i.test(f));
  } catch {
    return []; // directory doesn't exist yet — fine
  }
  const specs: BrowserAdapterSpec[] = [];
  for (const file of files) {
    try {
      const doc = yaml.load(readFileSync(path.join(userAdapterDir(), file), 'utf8'));
      if (isValidSpec(doc)) specs.push(doc);
      else process.stderr.write(`sitewise: skipping invalid adapter ${file}\n`);
    } catch (err) {
      process.stderr.write(`sitewise: failed to load adapter ${file}: ${(err as Error).message}\n`);
    }
  }
  return specs;
}
