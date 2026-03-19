import { fetch as expoFetch } from 'expo/fetch';
import OpenAI from 'openai';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_FREE_MODEL = 'openrouter/free';

let didPatchFetch = false;

function getOpenRouterClient(apiKey: string) {
  // Ensure the OpenAI SDK uses Expo's streaming-capable `fetch`.
  if (!didPatchFetch) {
    didPatchFetch = true;
    (globalThis as any).fetch = expoFetch;
  }

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

export type StreamChatCompletionInput = {
  apiKey: string;
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
};

export async function* streamChatCompletion({
  apiKey,
  messages,
  model = OPENROUTER_FREE_MODEL,
  signal,
}: StreamChatCompletionInput): AsyncGenerator<string, void, void> {
  const client = getOpenRouterClient(apiKey);

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

