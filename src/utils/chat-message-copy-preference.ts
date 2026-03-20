import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  getMessageCopyEnabledStorageKey,
  getSessionAccountStorageSuffix,
} from "@/utils/session-account-storage";

/** Stored when the user turns message copy on. Off / unset = feature disabled (default). */
export const MESSAGE_COPY_ENABLED_VALUE = "1";

export function isMessageCopyEnabledFromStorage(raw: string | null): boolean {
  return raw === MESSAGE_COPY_ENABLED_VALUE || raw === "true";
}

/**
 * Read current value from SecureStore / localStorage (authoritative).
 * Use this on Chat focus so toggling in Settings applies without remounting the tab.
 */
export async function readMessageCopyEnabledForSession(
  session: string | null,
): Promise<boolean> {
  if (!getSessionAccountStorageSuffix(session)) {
    return false;
  }
  const key = getMessageCopyEnabledStorageKey(session);
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return false;
      return isMessageCopyEnabledFromStorage(localStorage.getItem(key));
    }
    const raw = await SecureStore.getItemAsync(key);
    return isMessageCopyEnabledFromStorage(raw);
  } catch {
    return false;
  }
}
