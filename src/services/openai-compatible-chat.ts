import { fetch as expoFetch } from 'expo/fetch';
import OpenAI from 'openai';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Bundled default: OpenAI-compatible endpoint (works with OpenRouter-style gateways). */
export const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Default when no model is saved. On OpenRouter, avoids the shared `openrouter/free`
 * pool (very strict 429s). If unavailable for your provider, pick another model in Chat.
 */
export const DEFAULT_CHAT_MODEL_ID =
  'meta-llama/llama-3.2-3b-instruct:free';

let didPatchFetch = false;

function ensureExpoFetchPatched() {
  if (!didPatchFetch) {
    didPatchFetch = true;
    (globalThis as any).fetch = expoFetch;
  }
}

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

/**
 * Appends the version path OpenAI-compatible clients expect when the user omits it.
 * Handles common hosts (e.g. openrouter.ai → `/api/v1`, api.openai.com → `/v1`).
 */
export function coerceOpenAiCompatibleBaseUrl(normalized: string): string {
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return normalized;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '') || '';

  if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) {
    if (path === '' || path === '/') {
      return `${url.origin}/api/v1`;
    }
    if (path === '/api') {
      return `${url.origin}/api/v1`;
    }
    return `${url.origin}${path}`;
  }

  if (host === 'api.openai.com') {
    if (path === '' || path === '/') {
      return `${url.origin}/v1`;
    }
    return `${url.origin}${path}`;
  }

  if (path === '' || path === '/') {
    return `${url.origin}/v1`;
  }

  return `${url.origin}${path}`;
}

export function resolveOpenAiCompatibleBaseUrl(
  stored: string | null | undefined
): string {
  const raw = stored?.trim();
  if (!raw) return DEFAULT_OPENAI_COMPAT_BASE_URL;
  try {
    const normalized = normalizeOpenAiCompatibleBaseUrl(raw);
    return coerceOpenAiCompatibleBaseUrl(normalized);
  } catch {
    return DEFAULT_OPENAI_COMPAT_BASE_URL;
  }
}

function getOpenAiClient(apiKey: string, baseURL: string) {
  ensureExpoFetchPatched();

  /** Some gateways document optional Referer/title headers for usage attribution. */
  const attachRankingHeaders = baseURL.toLowerCase().includes('openrouter.ai');

  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
    /** Retries on 429/5xx multiply requests and worsen rate limits on free tiers. */
    maxRetries: 0,
    defaultHeaders: attachRankingHeaders
      ? {
          'HTTP-Referer': 'https://expo.dev',
          'X-Title': 'Chat App',
        }
      : undefined,
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
  model = DEFAULT_CHAT_MODEL_ID,
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

/**
 * Lists model ids via the OpenAI SDK (`client.models.list()`), same client as chat.
 * Paginates automatically using the SDK async iterator.
 */
export async function listOpenAiCompatibleChatModels(params: {
  apiKey: string;
  baseURL?: string | null;
  signal?: AbortSignal;
}): Promise<string[]> {
  const baseURL = resolveOpenAiCompatibleBaseUrl(params.baseURL);
  const client = getOpenAiClient(params.apiKey, baseURL);

  const listOptions =
    params.signal != null ? { signal: params.signal } : undefined;

  const ids: string[] = [];
  for await (const model of client.models.list(listOptions)) {
    if (typeof model.id === 'string' && model.id.trim()) {
      ids.push(model.id.trim());
    }
  }

  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
