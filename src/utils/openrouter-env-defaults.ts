/**
 * Optional default OpenRouter / OpenAI-compatible API key from Expo public env.
 * Embedded in the client bundle — use for local dev only, not production secrets.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */
export function getDefaultOpenRouterApiKeyFromEnv(): string | undefined {
  const candidates = [
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
    process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/** Prefer saved key; otherwise env default (if any). */
export function resolveOpenRouterApiKey(
  stored: string | null | undefined
): string {
  const fromStore = stored?.trim();
  if (fromStore) return fromStore;
  return getDefaultOpenRouterApiKeyFromEnv() ?? '';
}

export function hasEnvDefaultOpenRouterApiKey(): boolean {
  return !!getDefaultOpenRouterApiKeyFromEnv();
}
