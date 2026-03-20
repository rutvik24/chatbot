import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type ChatActionsValue = {
  /** Clears the in-memory chat (registered by the chat screen). */
  startNewChat: () => void;
  /** Called from the chat screen so the drawer can trigger a reset. */
  registerStartNewChat: (handler: (() => void) | null) => void;
};

const ChatActionsContext = createContext<ChatActionsValue | null>(null);

export function ChatActionsProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);
  /** Set when the user requests a new chat while the chat screen isn’t mounted (e.g. on Settings). */
  const pendingNewChatRef = useRef(false);

  const registerStartNewChat = useCallback((handler: (() => void) | null) => {
    handlerRef.current = handler;
    if (handler && pendingNewChatRef.current) {
      pendingNewChatRef.current = false;
      handler();
    }
  }, []);

  const startNewChat = useCallback(() => {
    const fn = handlerRef.current;
    if (fn) {
      fn();
    } else {
      pendingNewChatRef.current = true;
    }
  }, []);

  const value = useMemo(
    () => ({ startNewChat, registerStartNewChat }),
    [startNewChat, registerStartNewChat],
  );

  return (
    <ChatActionsContext.Provider value={value}>
      {children}
    </ChatActionsContext.Provider>
  );
}

export function useChatActions(): ChatActionsValue {
  const ctx = useContext(ChatActionsContext);
  if (!ctx) {
    throw new Error("useChatActions must be used within ChatActionsProvider");
  }
  return ctx;
}
