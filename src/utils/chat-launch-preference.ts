import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getSessionAccountStorageSuffix } from "@/utils/session-account-storage";

/**
 * What to show when you open Chat after signing in (or when your session loads).
 * Stored per account in SecureStore (native) / localStorage (web), same suffix as chat
 * history — survives sign-out / sign-in for the same email.
 */
export type ChatLaunchPreference = "resume_recent" | "start_fresh";

export const DEFAULT_CHAT_LAUNCH_PREFERENCE: ChatLaunchPreference =
  "resume_recent";

/** SecureStore-safe key per signed-in user. */
export function getChatLaunchPreferenceStorageKey(
  session: string | null,
): string {
  const suffix = getSessionAccountStorageSuffix(session);
  if (!suffix) return "chat-launch-preference";
  return `chat-launch-preference-${suffix}`;
}

function parseChatLaunchPreference(
  raw: string | null,
): ChatLaunchPreference {
  if (raw === "start_fresh" || raw === "resume_recent") {
    return raw;
  }
  return DEFAULT_CHAT_LAUNCH_PREFERENCE;
}

export async function getChatLaunchPreference(
  session: string | null,
): Promise<ChatLaunchPreference> {
  const key = getChatLaunchPreferenceStorageKey(session);
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") {
        return DEFAULT_CHAT_LAUNCH_PREFERENCE;
      }
      return parseChatLaunchPreference(localStorage.getItem(key));
    }
    const value = await SecureStore.getItemAsync(key);
    return parseChatLaunchPreference(value);
  } catch {
    return DEFAULT_CHAT_LAUNCH_PREFERENCE;
  }
}
