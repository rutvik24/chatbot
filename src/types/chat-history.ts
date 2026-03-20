import type { ChatMessageWithTime } from "@/utils/chat-timeline";

/** Encrypted on-disk / localStorage payload version. */
export const CHAT_HISTORY_VERSION = 1 as const;

export type StoredChatSession = {
  id: string;
  /** Short label from the first user turn (for the drawer list). */
  title: string;
  updatedAt: number;
  modelId: string;
  messages: ChatMessageWithTime[];
};

export type ChatHistoryStoreData = {
  version: typeof CHAT_HISTORY_VERSION;
  /** Currently open thread id in the chat UI. */
  activeSessionId: string | null;
  sessions: StoredChatSession[];
};

/** Lightweight row for drawer lists (no message bodies). */
export type ChatHistorySummary = {
  id: string;
  title: string;
  updatedAt: number;
};
