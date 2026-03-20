import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getSessionAccountStorageSuffix } from "@/utils/session-account-storage";

/**
 * Global API key slot (pre–per-account). Backing id unchanged so existing installs
 * keep their key (`openrouter-api-key`). Cleared after migration to a per-user key
 * or when the user clears their saved key so it cannot repopulate the field.
 */
export const GLOBAL_API_KEY_STORAGE_KEY = "openrouter-api-key";

/** Removes the global API key entry from SecureStore / localStorage. */
export async function clearGlobalApiKeyStorage(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(GLOBAL_API_KEY_STORAGE_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(GLOBAL_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore missing key / platform quirks.
  }
}

/**
 * Storage key for the current session’s API key. Uses legacy `openrouter-api-key*`
 * ids for backward compatibility with existing secure storage entries.
 */
export function getAiApiKeyStorageKey(session: string | null): string {
  const email = session?.startsWith("session-")
    ? session.slice("session-".length)
    : null;
  if (!email) return GLOBAL_API_KEY_STORAGE_KEY;

  // SecureStore keys must be alphanumeric + ".", "-", "_" only.
  // Emails contain characters like "@" so we sanitize to a safe representation.
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_");

  return safeEmail
    ? `openrouter-api-key-${safeEmail}`
    : GLOBAL_API_KEY_STORAGE_KEY;
}

/** Per-user OpenAI-compatible API base URL (any compatible gateway). */
export function getOpenAiCompatibleBaseUrlStorageKey(
  session: string | null,
): string {
  const suffix = getSessionAccountStorageSuffix(session);
  if (!suffix) return "openai-compatible-base-url";
  return `openai-compatible-base-url-${suffix}`;
}

/** Per-user selected chat model id (OpenAI-compatible `model` string). */
export function getChatModelIdStorageKey(session: string | null): string {
  const suffix = getSessionAccountStorageSuffix(session);
  if (!suffix) return "chat-model-id";
  return `chat-model-id-${suffix}`;
}
