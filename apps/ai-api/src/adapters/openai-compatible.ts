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
}

interface ChatCompletionChoice {
  message?: {
    content?: string | null;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
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
  if (rule.endsWith('*')) {
    return model.startsWith(rule.slice(0, -1));
  }
  return model === rule;
}

function serializeThinking(
  model: string,
  thinkingModels: ReadonlySet<string>,
  nonThinkingModels: ReadonlySet<string>,
  thinking?: OpenAICompatibleThinking,
): OpenAICompatibleThinking | undefined {
  if (!thinking) {
    return undefined;
  }
  const normalizedModel = normalizeModelName(model);
  if (Array.from(nonThinkingModels).some((rule) => matchesModelRule(normalizedModel, rule))) {
    return undefined;
  }
  if (thinkingModels.size === 0) {
    return thinking;
  }
  return Array.from(thinkingModels).some((rule) => matchesModelRule(normalizedModel, rule)) ? thinking : undefined;
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

  constructor(options: OpenAICompatibleClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.temperature = options.temperature ?? 0.6;
    this.thinkingModels = new Set((options.thinkingModels ?? []).map((model) => normalizeModelName(model)));
    this.nonThinkingModels = new Set((options.nonThinkingModels ?? []).map((model) => normalizeModelName(model)));
  }

  buildRequestDebugSummary(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking: OpenAICompatibleThinking | undefined,
    stream: boolean,
  ): OpenAICompatibleRequestDebugSummary {
    const serializedThinking = serializeThinking(model, this.thinkingModels, this.nonThinkingModels, thinking);
    return {
      model,
      stream,
      temperature: this.temperature,
      messageCount: messages.length,
      responseFormat: stream ? null : 'json_object',
      hasThinking: Boolean(serializedThinking),
      ...(serializedThinking ? { thinking: serializedThinking } : {}),
    };
  }

  async chat(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking?: OpenAICompatibleThinking,
  ): Promise<string> {
    const serializedThinking = serializeThinking(model, this.thinkingModels, this.nonThinkingModels, thinking);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.temperature,
        stream: false,
        response_format: {
          type: 'json_object',
        },
        ...(serializedThinking ? { thinking: serializedThinking } : {}),
      }),
    });

    if (!response.ok) {
      throw new LLMError(await readErrorMessage(response), 'OPENAI_COMPAT_ERROR');
    }

    const payload = await response.json() as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new LLMError('Provider returned empty content', 'OPENAI_COMPAT_EMPTY');
    }
    return content;
  }

  async *streamChat(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking?: OpenAICompatibleThinking,
  ): AsyncIterable<{ text: string }> {
    const serializedThinking = serializeThinking(model, this.thinkingModels, this.nonThinkingModels, thinking);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.temperature,
        stream: true,
        ...(serializedThinking ? { thinking: serializedThinking } : {}),
      }),
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
