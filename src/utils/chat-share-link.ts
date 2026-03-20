import Constants from "expo-constants";
import * as Linking from "expo-linking";

function resolveAppScheme(): string {
  const s = Constants.expoConfig?.scheme;
  if (typeof s === "string" && s.length > 0) return s;
  if (Array.isArray(s) && typeof s[0] === "string") return s[0];
  return "chatapp";
}

/**
 * Deep link for a thread id.
 *
 * - **Expo Go** (`appOwnership === 'expo'`): `Linking.createURL` → `exp://…/--/chat/<id>` so
 *   shared links open in another Expo Go + Metro session (Android no longer diverges from
 *   “real” scheme only in this case).
 * **Development client** (`expo run:ios|android`) **and release / store builds:** explicit
 * `chatapp://chat/<id>` (scheme from `app.json`) — same as iOS, suitable for SMS and QA.
 *
 * Opening the link loads that chat from **local** history when the same account has it saved.
 */
export function buildChatDeepLink(sessionId: string): string {
  const trimmed = sessionId?.trim() ?? "";
  if (!trimmed) return "";
  const encoded = encodeURIComponent(trimmed);
  const path = `chat/${encoded}`;

  if (Constants.appOwnership === "expo") {
    return Linking.createURL(path);
  }

  return `${resolveAppScheme()}://chat/${encoded}`;
}
