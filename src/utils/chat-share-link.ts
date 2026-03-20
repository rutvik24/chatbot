import * as Linking from "expo-linking";

/**
 * Universal deep link for a thread id (`chatapp://chat/<id>` in production builds).
 * Opening it loads that chat from **local** history when the same account has it saved.
 */
export function buildChatDeepLink(sessionId: string): string {
  const trimmed = sessionId?.trim() ?? "";
  if (!trimmed) return "";
  return Linking.createURL(`chat/${encodeURIComponent(trimmed)}`);
}
