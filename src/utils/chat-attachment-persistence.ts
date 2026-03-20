import { Platform } from "react-native";

import { CHAT_WEB_PERSIST_DATA_URL_MAX_CHARS } from "@/utils/chat-attachment-constants";
import type { ChatAttachment, ChatMessageWithTime } from "@/utils/chat-timeline";

function sanitizeAttachment(a: ChatAttachment): ChatAttachment {
  if (Platform.OS !== "web") return a;
  const u = a.localUri ?? "";
  if (u.startsWith("data:") && u.length > CHAT_WEB_PERSIST_DATA_URL_MAX_CHARS) {
    const { localUri: _drop, ...meta } = a;
    return meta;
  }
  return a;
}

/**
 * Shrinks messages before writing to web localStorage (data URLs blow the quota).
 * Native keeps `file://` URIs — small JSON, files stay on disk.
 */
export function sanitizeChatMessagesForPersistence(
  messages: ChatMessageWithTime[],
): ChatMessageWithTime[] {
  if (Platform.OS !== "web") return messages;
  return messages.map((m) => {
    if (m.role !== "user" || !m.attachments?.length) return m;
    return {
      ...m,
      attachments: m.attachments.map(sanitizeAttachment),
    };
  });
}
