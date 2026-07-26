import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { userAdapterDir } from '../adapters/web/user-adapters.js';
import type { BrowserAdapterSpec } from './declarative.js';
import type { HealProposal } from './heal.js';

/** Return a copy of `spec` with one command's selectors replaced by a healed proposal. */
export function applyHeal(spec: BrowserAdapterSpec, commandName: string, proposal: HealProposal): BrowserAdapterSpec {
  return {
    ...spec,
    commands: spec.commands.map((cmd) =>
      cmd.name === commandName
        ? { ...cmd, waitFor: proposal.selector, list: { ...cmd.list, selector: proposal.selector, fields: proposal.fields } }
        : cmd,
    ),
  };
}

/**
 * Write a (healed) adapter spec to ~/.sitewise/adapters/<name>.yaml. User
 * adapters override built-ins of the same name, so this makes the repair stick
 * without touching shipped code — and the user can hand-edit the YAML later.
 */
export function persistSpec(spec: BrowserAdapterSpec): string {
  const dir = userAdapterDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${spec.name}.yaml`);
  writeFileSync(file, yaml.dump(spec, { lineWidth: 120 }));
  return file;
}
