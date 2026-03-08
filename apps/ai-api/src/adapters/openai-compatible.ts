import { LLMError } from './errors.ts';

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string | null;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
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

  async chat(model: string, messages: OpenAICompatibleMessage[]): Promise<string> {
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

  async *streamChat(model: string, messages: OpenAICompatibleMessage[]): AsyncIterable<{ text: string }> {
    const text = await this.chat(model, messages);
    yield { text };
  }
}
