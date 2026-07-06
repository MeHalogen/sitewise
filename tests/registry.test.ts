import { describe, expect, it } from 'vitest';
import { adapters, findCommand, listCommands } from '../src/registry.js';

describe('registry', () => {
  it('has unique adapter names', () => {
    const names = adapters.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has unique command names within each adapter', () => {
    for (const a of adapters) {
      const names = a.commands.map((c) => c.name);
      expect(new Set(names).size, `duplicate command in ${a.name}`).toBe(names.length);
    }
  });

  it('every command has a description and run function', () => {
    for (const { site, command } of listCommands()) {
      const cmd = findCommand(site, command);
      expect(cmd?.description.length, `${site}/${command}`).toBeGreaterThan(5);
      expect(typeof cmd?.run).toBe('function');
    }
  });

  it('finds commands and misses gracefully', () => {
    expect(findCommand('hackernews', 'top')).toBeDefined();
    expect(findCommand('nope', 'top')).toBeUndefined();
  });
});
