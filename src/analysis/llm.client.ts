import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../settings/settings.types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** El proveedor respondió 429: hay que pausarlo y rotar al siguiente. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/**
 * Cliente mínimo para cualquier API compatible con OpenAI Chat Completions
 * (Groq, OpenRouter, Gemini, Cerebras, Ollama, LM Studio, ...).
 * No reintenta: la rotación entre proveedores la maneja AnalyzerService.
 */
@Injectable()
export class LlmClient {
  constructor(private readonly config: ConfigService) {}

  async completeJson<T>(provider: LlmProvider, messages: ChatMessage[]): Promise<T> {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(this.config.get<number>('llm.timeoutMs')!),
    });

    if (res.status === 429) {
      const body = (await res.text()).slice(0, 300);
      throw new RateLimitError(`429 rate limit: ${body}`, parseRetryAfter(res.headers));
    }
    if (!res.ok) {
      throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('respuesta vacía');
    return JSON.parse(stripCodeFence(content)) as T;
  }
}

/** retry-after (segundos o fecha HTTP), o los headers x-ratelimit-reset-* que usan Groq/OpenRouter. */
function parseRetryAfter(h: Headers): number | undefined {
  const retryAfter = h.get('retry-after');
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return secs * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = h.get('x-ratelimit-reset-requests') ?? h.get('x-ratelimit-reset-tokens') ?? h.get('x-ratelimit-reset');
  if (reset) {
    // Groq: "2m59.56s" / "7.66s"; OpenRouter: timestamp en ms
    const n = Number(reset);
    if (Number.isFinite(n)) return n > 1e12 ? Math.max(0, n - Date.now()) : n * 1000;
    const m = reset.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/);
    if (m) {
      return ((+(m[1] ?? 0) * 60 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0)) * 1000 + +(m[4] ?? 0);
    }
  }
  return undefined;
}

function stripCodeFence(s: string): string {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : s;
}
