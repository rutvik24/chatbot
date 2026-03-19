import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Global API key slot (pre–per-account). Same backing id as early builds
 * (`openrouter-api-key`). Cleared after migration to a per-user key or when
 * the user clears their saved key so it cannot repopulate the field.
 */
export const GLOBAL_API_KEY_STORAGE_KEY = 'openrouter-api-key';

/** Removes the global API key entry from SecureStore / localStorage. */
export async function clearGlobalApiKeyStorage(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(GLOBAL_API_KEY_STORAGE_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(GLOBAL_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore missing key / platform quirks.
  }
}

export function getOpenRouterApiKeyStorageKey(session: string | null): string {
  const email = session?.startsWith('session-') ? session.slice('session-'.length) : null;
  if (!email) return GLOBAL_API_KEY_STORAGE_KEY;

  // SecureStore keys must be alphanumeric + ".", "-", "_" only.
  // Emails contain characters like "@" so we sanitize to a safe representation.
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');

  return safeEmail
    ? `openrouter-api-key-${safeEmail}`
    : GLOBAL_API_KEY_STORAGE_KEY;
}

/** Per-user OpenAI-compatible API base URL (e.g. OpenRouter, local proxy). */
export function getOpenAiCompatibleBaseUrlStorageKey(
  session: string | null
): string {
  const email = session?.startsWith('session-')
    ? session.slice('session-'.length)
    : null;
  if (!email) return 'openai-compatible-base-url';

  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');

  return safeEmail
    ? `openai-compatible-base-url-${safeEmail}`
    : 'openai-compatible-base-url';
}

