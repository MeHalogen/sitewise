/**
 * Thin LLM client used by the intelligent features (self-healing, ask,
 * adapter authoring). It is an injectable interface so the logic that uses it
 * stays unit-testable without an API key, and so the CLI degrades gracefully
 * when no key is present.
 *
 * Uses the official Anthropic SDK. Bring your own key via ANTHROPIC_API_KEY;
 * override the model with SITEWISE_LLM_MODEL (defaults to claude-opus-4-8).
 * When sitewise runs as an MCP server the agent supplies the intelligence, so
 * a key is only needed for standalone CLI use of these features.
 */

export interface LLM {
  /** Ask the model for JSON matching a described shape; returns the parsed value. */
  json<T>(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<T>;
}

export const DEFAULT_MODEL = 'claude-opus-4-8';

export function llmModel(): string {
  return process.env.SITEWISE_LLM_MODEL ?? DEFAULT_MODEL;
}

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Strip Markdown code fences and pull the first JSON object/array out of a model reply. */
export function parseJsonReply<T>(text: string): T {
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  // If there's prose around the JSON, grab the outermost object or array.
  if (!(s.startsWith('{') || s.startsWith('['))) {
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (start !== -1 && end > start) s = s.slice(start, end + 1);
  }
  return JSON.parse(s) as T;
}

class MissingKeyLLM implements LLM {
  json<T>(): Promise<T> {
    return Promise.reject(
      new Error('This feature needs an LLM. Set ANTHROPIC_API_KEY (or run sitewise via MCP so the agent provides it).'),
    );
  }
}

class AnthropicLLM implements LLM {
  async json<T>(prompt: string, opts: { system?: string; maxTokens?: number } = {}): Promise<T> {
    // Imported lazily so the CLI starts fast and the dep is only loaded on use.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const message = await client.messages.create({
      model: llmModel(),
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
    return parseJsonReply<T>(text);
  }
}

/** The LLM the CLI uses. Returns a stub that errors helpfully when no key is set. */
export function defaultLLM(): LLM {
  return llmAvailable() ? new AnthropicLLM() : new MissingKeyLLM();
}
