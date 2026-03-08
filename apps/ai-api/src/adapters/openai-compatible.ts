import { LLMError } from './errors.ts';

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
}

export interface OpenAICompatibleThinking {
  type: 'enabled' | 'disabled';
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

  constructor(options: OpenAICompatibleClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
  }

  async chat(
    model: string,
    messages: OpenAICompatibleMessage[],
    thinking?: OpenAICompatibleThinking,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        stream: false,
        ...(thinking ? { thinking } : {}),
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
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        stream: true,
        ...(thinking ? { thinking } : {}),
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
