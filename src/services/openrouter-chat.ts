import { fetch as expoFetch } from 'expo/fetch';
import OpenAI from 'openai';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Default OpenAI-compatible endpoint (OpenRouter). */
export const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Default when no model is saved. Avoids `openrouter/free` (shared pool, very strict 429s).
 * If this id is unavailable for your key, open the model picker and choose another `:free` model.
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
 * Fixes 404s from `https://openrouter.ai` (needs `/api/v1`) vs `https://api.openai.com` (`/v1`).
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

  const isOpenRouter = baseURL.toLowerCase().includes('openrouter.ai');

  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
    /** Retries on 429/5xx multiply requests and make OpenRouter free-tier limits feel worse. */
    maxRetries: 0,
    defaultHeaders: isOpenRouter
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

