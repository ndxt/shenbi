import { LLMError } from './errors.ts';

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
  temperature?: number;
  thinkingModels?: string[];
  nonThinkingModels?: string[];
  /** Models that use Qwen-style `enable_thinking: boolean` instead of the Anthropic `thinking` object. */
  enableThinkingModels?: string[];
  provider?: string;
}

export interface OpenAICompatibleThinking {
  type: 'enabled' | 'disabled';
}

export interface OpenAICompatibleRequestDebugSummary {
  model: string;
  stream: boolean;
  temperature: number;
  messageCount: number;
  responseFormat: 'json_object' | null;
  hasThinking: boolean;
  thinking?: OpenAICompatibleThinking | undefined;
  /** Set only for Qwen-style models that use `enable_thinking` instead of the `thinking` object. */
  enableThinking?: boolean | undefined;
  /** The full URL of the chat completions endpoint. */
  requestUrl: string;
  /** The actual request body sent to the API (for debugging). */
  requestBody: Record<string, unknown>;
}

interface ChatCompletionChoice {
  message?: {
    content?: string | null;
  };
}

interface ChatCompletionUsage {
  total_tokens?: number;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

interface StreamDelta {
  content?: string | null;
}

interface StreamChoice {
  delta?: StreamDelta;
  finish_reason?: string | null;
}

interface StreamChunk {
  choices?: StreamChoice[];
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function normalizeModelName(model: string): string {
  return model.trim().toLowerCase();
}

function matchesModelRule(model: string, rule: string): boolean {
  // Strip provider prefix (e.g. "openai/gpt-4o-mini" → "gpt-4o-mini") so that
  // patterns like "gpt*" match both bare and provider-prefixed model names.
  const bareModel = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model;
  if (rule.endsWith('*')) {
    const prefix = rule.slice(0, -1);
    return model.startsWith(prefix) || bareModel.startsWith(prefix);
  }
  return model === rule || bareModel === rule;
}

type ThinkingFormat =
  | { kind: 'none' }
  | { kind: 'anthropic'; value: OpenAICompatibleThinking }
  | { kind: 'qwen'; enabled: boolean };

function matchesAnyRule(normalizedModel: string, rules: ReadonlySet<string>): boolean {
  return Array.from(rules).some((rule) => matchesModelRule(normalizedModel, rule));
}

/**
 * Determine which thinking format to use for a given model:
 *   - 'none'     (Format A): gpt*, gemini*, or other non-thinking models
 *   - 'anthropic' (Format B): claude*, glm*, and other models → `thinking: { type }`
 *   - 'qwen'     (Format C): qwen* models → `enable_thinking: boolean` only
 */
function resolveThinkingFormat(
  model: string,
  thinkingModels: ReadonlySet<string>,
  nonThinkingModels: ReadonlySet<string>,
  enableThinkingModels: ReadonlySet<string>,
  thinking?: OpenAICompatibleThinking,
): ThinkingFormat {
  if (!thinking) {
    return { kind: 'none' };
  }
  const normalized = normalizeModelName(model);

  // Format C: Qwen-style enable_thinking bool — checked before nonThinkingModels
  if (matchesAnyRule(normalized, enableThinkingModels)) {
    return { kind: 'qwen', enabled: thinking.type === 'enabled' };
  }

  // Format A: model explicitly excluded from thinking
  if (matchesAnyRule(normalized, nonThinkingModels)) {
    return { kind: 'none' };
  }

  // Format B: Anthropic-style thinking object
  // Only send if thinkingModels is empty (allow-all default) or model is whitelisted
  if (thinkingModels.size === 0 || matchesAnyRule(normalized, thinkingModels)) {
    return { kind: 'anthropic', value: thinking };
  }

  return { kind: 'none' };
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `${response.status} ${response.statusText}`.trim();
  }
  try {
    const payload = JSON.parse(text) as unknown;
    if (
      payload
      && typeof payload === 'object'
      && 'error' in payload
    ) {
      const error = (payload as { error?: unknown }).error;
      if (typeof error === 'string') {
        return error;
      }
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
    }
  } catch {
    // ignore JSON parse failure
  }
  return text;
}

export class OpenAICompatibleClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly thinkingModels: ReadonlySet<string>;
  private readonly nonThinkingModels: ReadonlySet<string>;
  private readonly enableThinkingModels: ReadonlySet<string>;

  constructor(options: OpenAICompatibleClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.temperature = options.temperature ?? 0.6;
    this.thinkingModels = new Set((options.thinkingModels ?? []).map((model) => normalizeModelName(model)));
    this.nonThinkingModels = new Set((options.nonThinkingModels ?? []).map((model) => normalizeModelName(model)));
    this.enableThinkingModels = new Set((options.enableThinkingModels ?? []).map((model) => normalizeModelName(model)));
  }

  private resolveFormat(model: string, thinking?: OpenAICompatibleThinking): ThinkingFormat {
    return resolveThinkingFormat(
      model,
      this.thinkingModels,
      this.nonThinkingModels,
      this.enableThinkingModels,
      thinking,
    );
  }

  private buildRequestBody(
    model: string,
    messages: OpenAICompatibleMessage[],
    fmt: ThinkingFormat,
    stream: boolean,
  ): Record<string, unknown> {
    return {
      model,
      messages,
      temperature: this.temperature,
      stream,
      ...(!stream ? { response_format: { type: 'json_object' } } : {}),
      ...(fmt.kind === 'qwen' ? { enable_thinking: fmt.enabled } : {}),
      ...(fmt.kind === 'anthropic' ? { thinking: fmt.value } : {}),
    };
  }

  buildRequestDebugSummary(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking: OpenAICompatibleThinking | undefined,
    stream: boolean,
  ): OpenAICompatibleRequestDebugSummary {
    const fmt = this.resolveFormat(model, thinking);
    const requestBody = this.buildRequestBody(model, messages, fmt, stream);
    return {
      model,
      stream,
      temperature: this.temperature,
      messageCount: messages.length,
      responseFormat: stream ? null : 'json_object',
      hasThinking: fmt.kind !== 'none',
      ...(fmt.kind === 'anthropic' ? { thinking: fmt.value } : {}),
      ...(fmt.kind === 'qwen' ? { enableThinking: fmt.enabled } : {}),
      requestUrl: `${this.baseUrl}/chat/completions`,
      requestBody,
    };
  }

  async chat(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking?: OpenAICompatibleThinking,
  ): Promise<{ content: string; tokensUsed?: number }> {
    const fmt = this.resolveFormat(model, thinking);
    const body = this.buildRequestBody(model, messages, fmt, false);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new LLMError(await readErrorMessage(response), 'OPENAI_COMPAT_ERROR');
    }

    const payload = await response.json() as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new LLMError('Provider returned empty content', 'OPENAI_COMPAT_EMPTY');
    }
    const tokensUsed = typeof payload.usage?.total_tokens === 'number' ? payload.usage.total_tokens : undefined;
    return { content, ...(tokensUsed !== undefined ? { tokensUsed } : {}) };
  }

  async *streamChat(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking?: OpenAICompatibleThinking,
  ): AsyncIterable<{ text: string }> {
    const fmt = this.resolveFormat(model, thinking);
    const body = this.buildRequestBody(model, messages, fmt, true);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new LLMError(await readErrorMessage(response), 'OPENAI_COMPAT_ERROR');
    }

    if (!response.body) {
      throw new LLMError('Provider returned no streaming body', 'OPENAI_COMPAT_EMPTY');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            continue;
          }
          if (trimmed === 'data: [DONE]') {
            return;
          }
          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const jsonStr = trimmed.slice('data:'.length).trim();
          if (!jsonStr) {
            continue;
          }

          try {
            const chunk = JSON.parse(jsonStr) as StreamChunk;
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content };
            }
          } catch {
            // Skip malformed SSE lines — some providers send non-JSON heartbeats
          }
        }
      }

      // Process any remaining data in the buffer
      buffer += decoder.decode();
      if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice('data:'.length).trim();
          if (jsonStr) {
            try {
              const chunk = JSON.parse(jsonStr) as StreamChunk;
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                yield { text: content };
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
