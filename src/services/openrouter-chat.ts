import { fetch as expoFetch } from 'expo/fetch';
import OpenAI from 'openai';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Default OpenAI-compatible endpoint (OpenRouter). */
export const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_FREE_MODEL = 'openrouter/free';

let didPatchFetch = false;

/** Normalize user input into a base URL suitable for the OpenAI SDK (no trailing slash). */
export function normalizeOpenAiCompatibleBaseUrl(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) {
    throw new Error('Base URL is empty.');
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  const u = new URL(s);
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${path}`;
}

export function resolveOpenAiCompatibleBaseUrl(
  stored: string | null | undefined
): string {
  const raw = stored?.trim();
  if (!raw) return DEFAULT_OPENAI_COMPAT_BASE_URL;
  try {
    return normalizeOpenAiCompatibleBaseUrl(raw);
  } catch {
    return DEFAULT_OPENAI_COMPAT_BASE_URL;
  }
}

function getOpenAiClient(apiKey: string, baseURL: string) {
  // Ensure the OpenAI SDK uses Expo's streaming-capable `fetch`.
  if (!didPatchFetch) {
    didPatchFetch = true;
    (globalThis as any).fetch = expoFetch;
  }

  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });
}

export type StreamChatCompletionInput = {
  apiKey: string;
  /** Stored value; empty/null uses {@link DEFAULT_OPENAI_COMPAT_BASE_URL}. */
  baseURL?: string | null;
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
};

export async function* streamChatCompletion({
  apiKey,
  baseURL: baseUrlStored,
  messages,
  model = OPENROUTER_FREE_MODEL,
  signal,
}: StreamChatCompletionInput): AsyncGenerator<string, void, void> {
  const baseURL = resolveOpenAiCompatibleBaseUrl(baseUrlStored);
  const client = getOpenAiClient(apiKey, baseURL);

  const stream = await client.chat.completions.create(
    {
      model,
      messages,
      stream: true,
    },
    signal ? ({ signal } as any) : undefined
  );

  for await (const chunk of stream as any) {
    const token = chunk?.choices?.[0]?.delta?.content;
    if (typeof token === 'string' && token.length > 0) {
      yield token;
    }
  }
}

