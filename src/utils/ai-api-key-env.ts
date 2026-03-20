/**
 * Optional default API key from Expo public env (OpenAI-compatible providers).
 * Embedded in the client bundle — use for local dev only, not production secrets.
 *
 * Resolution order: `EXPO_PUBLIC_AI_API_KEY`, then `EXPO_PUBLIC_OPENAI_API_KEY`,
 * then `EXPO_PUBLIC_OPENROUTER_API_KEY` (legacy alias).
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */
export function getDefaultAiApiKeyFromEnv(): string | undefined {
  const candidates = [
    process.env.EXPO_PUBLIC_AI_API_KEY,
    process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/** Prefer saved key; otherwise env default (if any). */
export function resolveAiApiKey(stored: string | null | undefined): string {
  const fromStore = stored?.trim();
  if (fromStore) return fromStore;
  return getDefaultAiApiKeyFromEnv() ?? '';
}

export function hasEnvDefaultAiApiKey(): boolean {
  return !!getDefaultAiApiKeyFromEnv();
}
