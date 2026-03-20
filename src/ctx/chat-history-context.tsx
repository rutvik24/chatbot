import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/ctx/auth-context";
import {
  deleteChatHistoryEntry,
  getStoredChatSession,
  loadChatHistoryStore,
  setActiveChatSession,
} from "@/services/chat-history-storage";
import type { ChatHistorySummary } from "@/types/chat-history";
import type { ChatMessageWithTime } from "@/utils/chat-timeline";

export type ApplyHistorySessionPayload = {
  sessionId: string;
  messages: ChatMessageWithTime[];
};

type ApplyHandler = ((payload: ApplyHistorySessionPayload) => void) | null;

type ChatHistoryContextValue = {
  summaries: ChatHistorySummary[];
  isSummariesLoading: boolean;
  refreshSummaries: () => Promise<void>;
  /** Debounced refresh after the chat screen persists (avoids decrypting on every token). */
  notifyPersisted: () => void;
  registerApplyHistorySession: (handler: ApplyHandler) => void;
  /** Loads a thread from local history if it exists. Returns whether it was found. */
  openHistorySession: (sessionId: string) => Promise<boolean>;
  deleteHistorySession: (sessionId: string) => Promise<void>;
};

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [summaries, setSummaries] = useState<ChatHistorySummary[]>([]);
  const [isSummariesLoading, setIsSummariesLoading] = useState(true);
  const applyRef = useRef<ApplyHandler>(null);
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSummaries = useCallback(async () => {
    if (!session) {
      setSummaries([]);
      setIsSummariesLoading(false);
      return;
    }
    setIsSummariesLoading(true);
    try {
      const store = await loadChatHistoryStore(session);
      const next: ChatHistorySummary[] = store.sessions
        .map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setSummaries(next);
    } catch {
      setSummaries([]);
    } finally {
      setIsSummariesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refreshSummaries();
  }, [refreshSummaries]);

  const notifyPersisted = useCallback(() => {
    if (notifyTimerRef.current) {
      clearTimeout(notifyTimerRef.current);
    }
    notifyTimerRef.current = setTimeout(() => {
      notifyTimerRef.current = null;
      void refreshSummaries();
    }, 900);
  }, [refreshSummaries]);

  const registerApplyHistorySession = useCallback((handler: ApplyHandler) => {
    applyRef.current = handler;
  }, []);

  const openHistorySession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!session) return false;
      const entry = await getStoredChatSession(session, sessionId);
      if (!entry) {
        await refreshSummaries();
        return false;
      }
      await setActiveChatSession(session, sessionId);
      applyRef.current?.({
        sessionId: entry.id,
        messages: entry.messages,
      });
      void refreshSummaries();
      return true;
    },
    [session, refreshSummaries],
  );

  const deleteHistorySession = useCallback(
    async (sessionId: string) => {
      if (!session) return;
      const { clearedActive, nextActiveId } = await deleteChatHistoryEntry(
        session,
        sessionId,
      );
      await refreshSummaries();
      if (clearedActive) {
        applyRef.current?.({
          sessionId: nextActiveId,
          messages: [],
        });
      }
    },
    [session, refreshSummaries],
  );

  const value = useMemo(
    () => ({
      summaries,
      isSummariesLoading,
      refreshSummaries,
      notifyPersisted,
      registerApplyHistorySession,
      openHistorySession,
      deleteHistorySession,
    }),
    [
      summaries,
      isSummariesLoading,
      refreshSummaries,
      notifyPersisted,
      registerApplyHistorySession,
      openHistorySession,
      deleteHistorySession,
    ],
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory(): ChatHistoryContextValue {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error("useChatHistory must be used within ChatHistoryProvider");
  }
  return ctx;
}
