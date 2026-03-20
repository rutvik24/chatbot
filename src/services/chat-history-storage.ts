/**
 * Local chat history as a single JSON blob in **Expo SecureStore** (native) or
 * **localStorage** (web). No extra AES layer — the OS protects native storage.
 *
 * Scoped per signed-in account via `getSessionAccountStorageSuffix` — same suffix
 * as API keys and chat launch prefs. **Not cleared on sign-out** so the same email
 * gets the same history after logging in again.
 *
 * **Size:** Very large chats may hit platform limits; we trim oldest sessions on save failure.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  CHAT_HISTORY_VERSION,
  type ChatHistoryStoreData,
  type StoredChatSession,
} from "@/types/chat-history";
import type { ChatMessageWithTime } from "@/utils/chat-timeline";
import { getSessionAccountStorageSuffix } from "@/utils/session-account-storage";

const MAX_STORED_SESSIONS = 80;

/** One SecureStore item per account holding the full history JSON. */
function historyStoreKey(session: string | null): string | null {
  const s = getSessionAccountStorageSuffix(session);
  if (!s) return null;
  return `chat-history-store-${s}`;
}

export function createChatSessionId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyStore(): ChatHistoryStoreData {
  return {
    version: CHAT_HISTORY_VERSION,
    activeSessionId: null,
    sessions: [],
  };
}

function isStoredSession(x: unknown): x is StoredChatSession {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.updatedAt === "number" &&
    typeof o.modelId === "string" &&
    Array.isArray(o.messages)
  );
}

function parseStoreJson(raw: string): ChatHistoryStoreData {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return emptyStore();
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== CHAT_HISTORY_VERSION || !Array.isArray(o.sessions)) {
    return emptyStore();
  }

  const sessions = o.sessions
    .filter(isStoredSession)
    .filter(storedSessionQualifiesForHistory);
  const activeSessionId =
    typeof o.activeSessionId === "string" ? o.activeSessionId : null;

  return {
    version: CHAT_HISTORY_VERSION,
    activeSessionId,
    sessions,
  };
}

async function readStoreRaw(session: string | null): Promise<string | null> {
  const key = historyStoreKey(session);
  if (!key) return null;

  if (Platform.OS === "web") {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeStoreRaw(session: string | null, json: string): Promise<boolean> {
  const key = historyStoreKey(session);
  if (!key) return false;

  if (Platform.OS === "web") {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(key, json);
      return true;
    } catch (e) {
      console.error("Chat history web save failed:", e);
      return false;
    }
  }

  try {
    await SecureStore.setItemAsync(key, json);
    return true;
  } catch (e) {
    console.error("Chat history SecureStore save failed:", e);
    return false;
  }
}

export async function loadChatHistoryStore(
  session: string | null,
): Promise<ChatHistoryStoreData> {
  if (!getSessionAccountStorageSuffix(session)) {
    return emptyStore();
  }

  try {
    const raw = await readStoreRaw(session);
    if (!raw?.trim()) {
      return emptyStore();
    }
    return parseStoreJson(raw);
  } catch (e) {
    console.error("Chat history load failed:", e);
    return emptyStore();
  }
}

async function saveChatHistoryStoreInternal(
  session: string | null,
  store: ChatHistoryStoreData,
): Promise<boolean> {
  if (!getSessionAccountStorageSuffix(session)) return false;

  const payload: ChatHistoryStoreData = {
    version: CHAT_HISTORY_VERSION,
    activeSessionId: store.activeSessionId,
    sessions: store.sessions,
  };
  const json = JSON.stringify(payload);
  return writeStoreRaw(session, json);
}

/**
 * Saves the store; if the blob is too large for SecureStore, drops older sessions and retries,
 * keeping the **active** thread when possible.
 */
async function saveChatHistoryStore(
  session: string | null,
  store: ChatHistoryStoreData,
): Promise<void> {
  let sessions = [...store.sessions];
  const activeId = store.activeSessionId;

  for (let i = 0; i < 8; i += 1) {
    const attempt: ChatHistoryStoreData = {
      version: CHAT_HISTORY_VERSION,
      activeSessionId: store.activeSessionId,
      sessions,
    };
    if (await saveChatHistoryStoreInternal(session, attempt)) return;

    if (sessions.length <= 1) {
      console.error(
        "Chat history: could not save even after trimming; data may be too large for SecureStore.",
      );
      return;
    }

    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const activeEntry = activeId
      ? sorted.find((s) => s.id === activeId)
      : undefined;
    const others = sorted.filter((s) => s.id !== activeId);
    const nextCount = Math.max(1, Math.floor(sessions.length / 2));
    const takeOthers = Math.max(0, nextCount - (activeEntry ? 1 : 0));
    sessions = activeEntry
      ? [activeEntry, ...others.slice(0, takeOthers)]
      : others.slice(0, nextCount);
  }
}

/**
 * Only threads where the user actually sent at least one non-empty message belong in History.
 * (No blank “new chats”, no assistant-only / placeholder-only rows.)
 */
function sessionQualifiesForHistory(messages: ChatMessageWithTime[]): boolean {
  return messages.some(
    (m) => m.role === "user" && m.content.trim().length > 0,
  );
}

function storedSessionQualifiesForHistory(s: StoredChatSession): boolean {
  return sessionQualifiesForHistory(s.messages);
}

function titleFromMessages(messages: ChatMessageWithTime[]): string {
  const first = messages.find(
    (m) => m.role === "user" && m.content.trim().length > 0,
  );
  const raw = first?.content.trim() ?? "Chat";
  if (raw.length <= 56) return raw;
  return `${raw.slice(0, 53)}…`;
}

/**
 * Upserts the current thread, trims the session list, and sets `activeSessionId`.
 */
export async function persistChatSession(
  session: string | null,
  args: {
    activeSessionId: string;
    currentSessionId: string;
    messages: ChatMessageWithTime[];
    modelId: string;
  },
): Promise<void> {
  if (!getSessionAccountStorageSuffix(session)) return;

  const store = await loadChatHistoryStore(session);
  let sessions = store.sessions.filter((s) => s.id !== args.currentSessionId);

  if (sessionQualifiesForHistory(args.messages)) {
    const entry: StoredChatSession = {
      id: args.currentSessionId,
      title: titleFromMessages(args.messages),
      updatedAt: Date.now(),
      modelId: args.modelId,
      messages: args.messages,
    };
    sessions.push(entry);
  }

  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  if (sessions.length > MAX_STORED_SESSIONS) {
    sessions = sessions.slice(0, MAX_STORED_SESSIONS);
  }

  await saveChatHistoryStore(session, {
    version: CHAT_HISTORY_VERSION,
    activeSessionId: args.activeSessionId,
    sessions,
  });
}

export async function setActiveChatSession(
  session: string | null,
  activeSessionId: string,
): Promise<void> {
  const store = await loadChatHistoryStore(session);
  await saveChatHistoryStore(session, {
    ...store,
    activeSessionId,
  });
}

export async function getStoredChatSession(
  session: string | null,
  sessionId: string,
): Promise<StoredChatSession | null> {
  const store = await loadChatHistoryStore(session);
  return store.sessions.find((s) => s.id === sessionId) ?? null;
}

export async function deleteChatHistoryEntry(
  session: string | null,
  sessionId: string,
): Promise<{ clearedActive: boolean; nextActiveId: string }> {
  if (!getSessionAccountStorageSuffix(session)) {
    return { clearedActive: false, nextActiveId: createChatSessionId() };
  }

  const store = await loadChatHistoryStore(session);
  const sessions = store.sessions.filter((s) => s.id !== sessionId);
  let active = store.activeSessionId;
  let clearedActive = false;
  let nextActiveId = active ?? createChatSessionId();

  if (active === sessionId) {
    clearedActive = true;
    nextActiveId = createChatSessionId();
    active = nextActiveId;
  }

  await saveChatHistoryStore(session, {
    version: CHAT_HISTORY_VERSION,
    activeSessionId: active,
    sessions,
  });

  return { clearedActive, nextActiveId };
}

/** Removes the history entry for this account from SecureStore / localStorage. */
export async function wipeChatHistoryForSession(
  session: string | null,
): Promise<void> {
  const key = historyStoreKey(session);
  if (!key) return;

  if (Platform.OS === "web") {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}
