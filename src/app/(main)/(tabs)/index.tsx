import {
  DrawerActions,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import MarkdownMessage from "@/components/markdown-message";
import { TabScreenHeader } from "@/components/tab-screen-header";
import { useChatActions } from "@/ctx/chat-actions-context";
import { useChatHistory } from "@/ctx/chat-history-context";
import { useSession } from "@/ctx/auth-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useStorageState } from "@/hooks/use-storage-state";
import {
  createChatSessionId,
  loadChatHistoryStore,
  persistChatSession,
} from "@/services/chat-history-storage";
import {
  DEFAULT_CHAT_MODEL_ID,
  listOpenAiCompatibleChatModels,
  streamChatCompletion,
  type ChatMessage,
} from "@/services/openai-compatible-chat";
import {
  buildChatTimelineRows,
  formatMessageTime,
  type ChatMessageWithTime,
  type ChatTimelineRow,
} from "@/utils/chat-timeline";
import { resolveAiApiKey } from "@/utils/ai-api-key-env";
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getAiApiKeyStorageKey,
  getChatModelIdStorageKey,
  getOpenAiCompatibleBaseUrlStorageKey,
} from "@/utils/ai-credentials-storage";
import {
  readMessageCopyEnabledForSession,
} from "@/utils/chat-message-copy-preference";
import { getChatLaunchPreference } from "@/utils/chat-launch-preference";
import { showToast } from "@/utils/toast-bus";
import { takePendingChatDeepLink } from "@/utils/chat-deeplink-pending";
import { buildChatDeepLink } from "@/utils/chat-share-link";
import {
  getFriendlyChatProviderError,
  logChatProviderError,
} from "@/utils/provider-chat-error";
import {
  buildUserPersonalizationSystemMessage,
  getUserProfileStorageKey,
} from "@/utils/user-profile-chat";

export default function HomeScreen() {
  useColorScheme();
  const navigation = useNavigation();
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const colors = useNativeThemeColors();
  const safeInsets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessageWithTime[]>([]);
  /** Stable id for the current thread (persisted + history). */
  const [chatSessionId, setChatSessionId] = useState("");
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const storageKey = useMemo(
    () => getAiApiKeyStorageKey(session),
    [session],
  );
  const baseUrlStorageKey = useMemo(
    () => getOpenAiCompatibleBaseUrlStorageKey(session),
    [session],
  );
  const profileStorageKey = useMemo(
    () => getUserProfileStorageKey(session),
    [session],
  );
  const modelStorageKey = useMemo(
    () => getChatModelIdStorageKey(session),
    [session],
  );
  /** Re-read from storage on Chat focus — Settings’ `useStorageState` does not update this tab. */
  const [messageCopyEnabled, setMessageCopyEnabled] = useState(false);
  const [[isKeyLoading, storedAiApiKey], setAiApiKey] =
    useStorageState(storageKey);
  const [[, storedOpenAiBaseUrl], setOpenAiBaseUrl] =
    useStorageState(baseUrlStorageKey);
  const [[, storedProfileJson], setProfileJson] =
    useStorageState(profileStorageKey);
  const [[, storedChatModelId], setStoredChatModelId] =
    useStorageState(modelStorageKey);
  const effectiveAiApiKey = useMemo(
    () => resolveAiApiKey(storedAiApiKey),
    [storedAiApiKey],
  );
  const effectiveChatModelId = useMemo(() => {
    const t = storedChatModelId?.trim();
    return t && t.length > 0 ? t : DEFAULT_CHAT_MODEL_ID;
  }, [storedChatModelId]);

  /** Modal: edit an existing user bubble (truncates later messages on save if text changed). */
  const [messageEdit, setMessageEdit] = useState<{
    id: string;
    draft: string;
  } | null>(null);
  const messageEditInputRef = useRef<TextInput>(null);

  const closeMessageEdit = useCallback(() => {
    setMessageEdit(null);
  }, []);

  const copyWholeMessage = useCallback(async (raw: string) => {
    const t = raw?.trim() ?? "";
    if (!t) return;
    try {
      await Clipboard.setStringAsync(t);
      showToast({
        variant: "success",
        title: "Copied",
        message: "Paste it anywhere — it stays on your clipboard.",
      });
    } catch {
      showToast({
        variant: "error",
        title: "Couldn’t copy",
        message: "Try again, or select the text and copy manually.",
      });
    }
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [isMigratingKey, setIsMigratingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** When true, new content (e.g. streaming) should keep the list pinned to the bottom. */
  const shouldAutoScrollRef = useRef(true);
  const isAtBottomRef = useRef(true);

  /** Pixels from bottom to count as “at end” (composer + bounce + rounding). */
  const scrollBottomThreshold = 80;
  /** Height of composer + error row; FAB sits just above it (avoids FlatList covering the button on Android). */
  const [bottomChromeHeight, setBottomChromeHeight] = useState(240);
  /** While true, ignore scroll-away updates so the jump FAB doesn’t flicker during animated scroll-to-end. */
  const jumpScrollLockUntilRef = useRef(0);
  /**
   * After “Catch up” or send: keep `shouldAutoScrollRef` true while the stream grows until the user
   * scrolls up past ~200px from the end or generation ends.
   */
  const stickToBottomRef = useRef(false);
  const STICK_TO_BOTTOM_CANCEL_PX = 200;
  /** While generating + pinned, tolerate small layout jitter before treating the user as “scrolled away”. */
  const STICK_CANCEL_WHILE_GENERATING_PX = 280;
  const prevScrolledAwayRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const [showJumpToBottomFab, setShowJumpToBottomFab] = useState(false);
  const fabOpacity = useRef(new Animated.Value(0)).current;
  const fabTranslateY = useRef(new Animated.Value(12)).current;

  const composerInputRef = useRef<TextInput>(null);
  const generationRunIdRef = useRef(0);

  /** Always points at latest `messages` for queue processors (avoids stale closures). */
  const messagesRef = useRef<ChatMessageWithTime[]>(messages);
  messagesRef.current = messages;

  /** FIFO: sends and edit→regenerate while a reply is streaming. Drained when a run finishes (not on Stop). */
  type QueuedGenerationJob =
    | { type: "send"; userText: string }
    | { type: "regenerate"; messageId: string; trimmed: string };
  const generationQueueRef = useRef<QueuedGenerationJob[]>([]);
  const [pendingGenerationQueueCount, setPendingGenerationQueueCount] =
    useState(0);

  const chatTimelineRows = useMemo(
    () => buildChatTimelineRows(messages),
    [messages],
  );
  const chatTimelineRowsRef = useRef(chatTimelineRows);
  chatTimelineRowsRef.current = chatTimelineRows;

  const listRef = useRef<FlatList<ChatTimelineRow>>(null);

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsStatus, setModelsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [modelsErrorMessage, setModelsErrorMessage] = useState<string | null>(
    null,
  );

  /** Avoid listing models on every chat mount (extra 429 pressure). Short TTL cache when picker reopens. */
  const modelsListCacheRef = useRef<{
    signature: string;
    fetchedAt: number;
    ids: string[];
  } | null>(null);

  useEffect(() => {
    modelsListCacheRef.current = null;
  }, [effectiveAiApiKey, storedOpenAiBaseUrl]);

  const { notifyPersisted, registerApplyHistorySession, openHistorySession } =
    useChatHistory();

  useEffect(() => {
    if (!session) {
      setMessages([]);
      setChatSessionId("");
      setHistoryHydrated(true);
      return;
    }

    let cancelled = false;
    setHistoryHydrated(false);
    setMessages([]);
    setChatSessionId("");

    void (async () => {
      const launchPref = await getChatLaunchPreference(session);
      const store = await loadChatHistoryStore(session);
      if (cancelled) return;

      if (launchPref === "start_fresh") {
        const id = createChatSessionId();
        setChatSessionId(id);
        setMessages([]);
        await persistChatSession(session, {
          activeSessionId: id,
          currentSessionId: id,
          messages: [],
          modelId: DEFAULT_CHAT_MODEL_ID,
        });
      } else if (store.activeSessionId) {
        const hit = store.sessions.find((s) => s.id === store.activeSessionId);
        setChatSessionId(store.activeSessionId);
        if (hit?.messages?.length) {
          setMessages(hit.messages);
        }
      } else {
        const id = createChatSessionId();
        setChatSessionId(id);
        await persistChatSession(session, {
          activeSessionId: id,
          currentSessionId: id,
          messages: [],
          modelId: DEFAULT_CHAT_MODEL_ID,
        });
      }
      if (!cancelled) {
        setHistoryHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!historyHydrated || !chatSessionId || !session) return;
    const t = setTimeout(() => {
      void (async () => {
        await persistChatSession(session, {
          activeSessionId: chatSessionId,
          currentSessionId: chatSessionId,
          messages,
          modelId: effectiveChatModelId,
        });
        notifyPersisted();
      })();
    }, 750);
    return () => clearTimeout(t);
  }, [
    messages,
    chatSessionId,
    session,
    effectiveChatModelId,
    historyHydrated,
    notifyPersisted,
  ]);

  /** Open thread after sign-in when user followed `chat/<id>` while logged out. */
  useEffect(() => {
    if (!session || !historyHydrated) return;
    const pending = takePendingChatDeepLink();
    if (!pending) return;
    void openHistorySession(pending).then((ok) => {
      if (!ok) {
        showToast({
          variant: "info",
          title: "Chat not found",
          message:
            "That conversation isn’t in your history on this device yet.",
        });
      }
    });
  }, [session, historyHydrated, openHistorySession]);

  const composerSubmitDisabled = useMemo(
    () =>
      !text.trim() ||
      isSessionLoading ||
      isMigratingKey ||
      !historyHydrated ||
      (isKeyLoading && !resolveAiApiKey(storedAiApiKey).trim()) ||
      !effectiveAiApiKey.trim(),
    [
      text,
      isSessionLoading,
      isMigratingKey,
      historyHydrated,
      isKeyLoading,
      storedAiApiKey,
      effectiveAiApiKey,
    ],
  );

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  const scrollToEndIfPinned = useCallback(() => {
    if (!shouldAutoScrollRef.current) return;
    const instant =
      stickToBottomRef.current || isGeneratingRef.current;
    listRef.current?.scrollToEnd({ animated: !instant });
  }, []);

  /** After markdown height changes, layout can lag one frame — snap scroll without animation. */
  const scheduleScrollToEndAfterLayout = useCallback(() => {
    if (!shouldAutoScrollRef.current) return;
    const run = () => {
      if (!shouldAutoScrollRef.current) return;
      listRef.current?.scrollToEnd({ animated: false });
    };
    queueMicrotask(run);
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  useEffect(() => {
    scrollToEndIfPinned();
  }, [chatTimelineRows.length, scrollToEndIfPinned]);

  useEffect(() => {
    const useDriver = Platform.OS !== "web";
    Animated.parallel([
      Animated.spring(fabOpacity, {
        toValue: showJumpToBottomFab ? 1 : 0,
        useNativeDriver: useDriver,
        friction: 9,
        tension: 80,
      }),
      Animated.spring(fabTranslateY, {
        toValue: showJumpToBottomFab ? 0 : 14,
        useNativeDriver: useDriver,
        friction: 9,
        tension: 80,
      }),
    ]).start();
  }, [fabOpacity, fabTranslateY, showJumpToBottomFab]);

  const jumpToBottomAnimated = useCallback(() => {
    stickToBottomRef.current = true;
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    prevScrolledAwayRef.current = false;
    jumpScrollLockUntilRef.current = Date.now() + 900;
    setShowJumpToBottomFab(false);
    const list = listRef.current;
    if (!list) return;
    list.scrollToEnd({ animated: false });
    requestAnimationFrame(() => {
      list.scrollToEnd({ animated: false });
      requestAnimationFrame(() => {
        list.scrollToEnd({ animated: false });
      });
    });
  }, []);

  /**
   * Pin to the latest messages when opening Chat, restoring history, or returning to the tab.
   */
  const snapChatListToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    stickToBottomRef.current = false;
    prevScrolledAwayRef.current = false;
    jumpScrollLockUntilRef.current = Date.now() + 700;
    setShowJumpToBottomFab(false);
    const list = listRef.current;
    if (!list) return;
    const run = () => list.scrollToEnd({ animated: false });
    queueMicrotask(run);
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(() => {
        run();
      });
    });
  }, []);

  /**
   * After session/history hydrates, land on the newest messages once (not on every new message).
   */
  useEffect(() => {
    if (!historyHydrated) return;
    if (chatTimelineRows.length === 0) return;
    const id = requestAnimationFrame(() => {
      snapChatListToBottom();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when `historyHydrated` flips; rows read from this commit
  }, [historyHydrated, snapChatListToBottom]);

  const wasGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating) {
      wasGeneratingRef.current = true;
      return;
    }
    if (!wasGeneratingRef.current) {
      return;
    }
    wasGeneratingRef.current = false;
    const id = setTimeout(() => {
      stickToBottomRef.current = false;
    }, 200);
    return () => clearTimeout(id);
  }, [isGenerating]);

  const updateJumpFabFromScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      if (contentSize.height <= 0 || layoutMeasurement.height <= 0) {
        return;
      }

      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const atBottom = distanceFromBottom <= scrollBottomThreshold;
      isAtBottomRef.current = atBottom;

      const now = Date.now();
      if (now < jumpScrollLockUntilRef.current) {
        if (atBottom) {
          shouldAutoScrollRef.current = true;
        }
        return;
      }

      const stickCancelPx =
        stickToBottomRef.current && isGeneratingRef.current
          ? STICK_CANCEL_WHILE_GENERATING_PX
          : STICK_TO_BOTTOM_CANCEL_PX;

      if (stickToBottomRef.current) {
        if (distanceFromBottom > stickCancelPx) {
          stickToBottomRef.current = false;
          shouldAutoScrollRef.current = false;
        } else {
          shouldAutoScrollRef.current = true;
        }
      } else {
        shouldAutoScrollRef.current = atBottom;
      }

      const scrolledAway = atBottom
        ? false
        : stickToBottomRef.current
          ? distanceFromBottom > stickCancelPx
          : true;

      if (prevScrolledAwayRef.current !== scrolledAway) {
        prevScrolledAwayRef.current = scrolledAway;
        setShowJumpToBottomFab(scrolledAway);
      }
    },
    [scrollBottomThreshold],
  );

  /**
   * When the user manually scrolls, stop auto follow — otherwise `onContentSizeChange`
   * during streaming keeps calling `scrollToEnd` and fights the gesture.
   */
  const releaseAutoFollowFromUserScroll = useCallback(() => {
    stickToBottomRef.current = false;
    shouldAutoScrollRef.current = false;
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    releaseAutoFollowFromUserScroll();
  }, [releaseAutoFollowFromUserScroll]);

  const handleMomentumScrollBegin = useCallback(() => {
    releaseAutoFollowFromUserScroll();
  }, [releaseAutoFollowFromUserScroll]);

  /** Tracks offset so wheel / trackpad scroll-up (e.g. web) can release follow without begin-drag. */
  const lastScrollOffsetYRef = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    // Only while streaming: wheel/trackpad up shouldn’t be confused with “new chat” scroll reset.
    if (
      isGeneratingRef.current &&
      y < lastScrollOffsetYRef.current - 6
    ) {
      releaseAutoFollowFromUserScroll();
    }
    lastScrollOffsetYRef.current = y;
    updateJumpFabFromScrollEvent(event);
  };

  useEffect(() => {
    if (effectiveAiApiKey.trim()) {
      setError(null);
    }
  }, [effectiveAiApiKey]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    if (!effectiveAiApiKey.trim() || isKeyLoading || isSessionLoading) {
      return;
    }

    const signature = `${effectiveAiApiKey}\0${storedOpenAiBaseUrl ?? ""}`;
    const cache = modelsListCacheRef.current;
    const staleMs = 120_000;
    if (
      cache &&
      cache.signature === signature &&
      Date.now() - cache.fetchedAt < staleMs
    ) {
      setAvailableModels(cache.ids);
      setModelsStatus("ready");
      setModelsErrorMessage(null);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    setModelsStatus("loading");
    setModelsErrorMessage(null);

    (async () => {
      try {
        const ids = await listOpenAiCompatibleChatModels({
          apiKey: effectiveAiApiKey,
          baseURL: storedOpenAiBaseUrl,
          signal: ac.signal,
        });
        if (!cancelled) {
          modelsListCacheRef.current = {
            signature,
            fetchedAt: Date.now(),
            ids,
          };
          setAvailableModels(ids);
          setModelsStatus("ready");
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") return;
        logChatProviderError(e, "models.list");
        setModelsStatus("error");
        setModelsErrorMessage(
          e instanceof Error ? e.message : "Failed to load models.",
        );
        setAvailableModels([]);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    modelPickerOpen,
    effectiveAiApiKey,
    storedOpenAiBaseUrl,
    isKeyLoading,
    isSessionLoading,
  ]);

  const filteredModelIds = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    let list = [...availableModels];
    if (effectiveChatModelId && !list.includes(effectiveChatModelId)) {
      list = [effectiveChatModelId, ...list];
    }
    if (!q) return list;
    return list.filter((id) => id.toLowerCase().includes(q));
  }, [availableModels, modelSearch, effectiveChatModelId]);

  useEffect(() => {
    // Migrate global API key -> per-user key once, then remove global storage
    // so clearing the per-user key does not re-import the old global value.
    if (isKeyLoading) return;
    if (!session) return;
    if (storageKey === GLOBAL_API_KEY_STORAGE_KEY) return;
    if (storedAiApiKey) return; // per-user key already exists

    let cancelled = false;
    (async () => {
      try {
        setIsMigratingKey(true);
        const next =
          Platform.OS === "web"
            ? typeof localStorage !== "undefined"
              ? localStorage.getItem(GLOBAL_API_KEY_STORAGE_KEY)
              : null
            : await SecureStore.getItemAsync(GLOBAL_API_KEY_STORAGE_KEY);

        if (!cancelled && next) {
          setAiApiKey(next);
          await clearGlobalApiKeyStorage();
        }
      } finally {
        if (!cancelled) setIsMigratingKey(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isKeyLoading,
    session,
    storageKey,
    storedAiApiKey,
    setAiApiKey,
  ]);

  // If the user updates the key in the Settings screen, the tab might remain mounted.
  // Re-read secure storage when the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshKey = async () => {
        try {
          if (Platform.OS === "web") {
            if (typeof localStorage === "undefined") return;
            const keyNext = localStorage.getItem(storageKey);
            const urlNext = localStorage.getItem(baseUrlStorageKey);
            const profileNext = localStorage.getItem(profileStorageKey);
            const modelNext = localStorage.getItem(modelStorageKey);
            if (isActive) {
              setAiApiKey(keyNext);
              setOpenAiBaseUrl(urlNext);
              setProfileJson(profileNext);
              setStoredChatModelId(modelNext);
            }
            return;
          }

          const [keyNext, urlNext, profileNext, modelNext] = await Promise.all([
            SecureStore.getItemAsync(storageKey),
            SecureStore.getItemAsync(baseUrlStorageKey),
            SecureStore.getItemAsync(profileStorageKey),
            SecureStore.getItemAsync(modelStorageKey),
          ]);
          if (isActive) {
            setAiApiKey(keyNext);
            setOpenAiBaseUrl(urlNext);
            setProfileJson(profileNext);
            setStoredChatModelId(modelNext);
          }
        } catch {
          // Ignore refresh errors; the user can still enter a new key.
        }
      };

      refreshKey();

      void (async () => {
        try {
          const on = await readMessageCopyEnabledForSession(session);
          if (isActive) setMessageCopyEnabled(on);
        } catch {
          if (isActive) setMessageCopyEnabled(false);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [
      baseUrlStorageKey,
      modelStorageKey,
      profileStorageKey,
      session,
      setOpenAiBaseUrl,
      setAiApiKey,
      setProfileJson,
      setStoredChatModelId,
      storageKey,
    ]),
  );

  // Opening the Chat tab: scroll to the latest messages when there is history to show.
  useFocusEffect(
    useCallback(() => {
      if (!historyHydrated) return;
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chatTimelineRowsRef.current.length > 0) {
            snapChatListToBottom();
          }
        });
      });
      return () => cancelAnimationFrame(id);
    }, [historyHydrated, snapChatListToBottom]),
  );

  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const appendAssistantToken = (assistantId: string, tokenBuffer: string) => {
    if (!tokenBuffer) return;
    const follow =
      shouldAutoScrollRef.current &&
      (stickToBottomRef.current || isGeneratingRef.current);
    setMessages((previous) =>
      previous.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + tokenBuffer } : m,
      ),
    );
    if (follow) {
      scheduleScrollToEndAfterLayout();
    }
  };

  type AssistantStreamCancel =
    | { mode: "send"; userMessageId: string; restoreComposer: string }
    | { mode: "edit" };

  /** Declared below; used from `runAssistantStream` `finally` (hoisted). */
  async function processGenerationQueue(): Promise<void> {
    if (isGeneratingRef.current) return;
    const q = generationQueueRef.current;
    if (q.length === 0) return;

    if (isSessionLoading || isMigratingKey) {
      setTimeout(() => void processGenerationQueue(), 200);
      return;
    }
    if (isKeyLoading && !resolveAiApiKey(storedAiApiKey).trim()) {
      setTimeout(() => void processGenerationQueue(), 200);
      return;
    }

    const job = q.shift()!;
    setPendingGenerationQueueCount(q.length);

    if (job.type === "send") {
      if (!effectiveAiApiKey.trim()) {
        setError("API key for your account is missing. Add it in AI settings.");
        void processGenerationQueue();
        return;
      }
      await performSendUserText(job.userText);
      return;
    }

    let nextBase: ChatMessageWithTime[] | null = null;
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === job.messageId);
      if (i === -1) return prev;
      const head = prev.slice(0, i);
      const updated: ChatMessageWithTime = {
        ...prev[i],
        content: job.trimmed,
      };
      nextBase = [...head, updated];
      return nextBase;
    });

    if (nextBase === null) {
      void processGenerationQueue();
      return;
    }

    if (!effectiveAiApiKey.trim()) {
      setError("API key for your account is missing. Add it in AI settings.");
      void processGenerationQueue();
      return;
    }

    await beginRegenerateAfterEdit(nextBase);
  }

  async function runAssistantStream(args: {
    runId: number;
    abortController: AbortController;
    assistantMessageId: string;
    history: ChatMessage[];
    cancelBehavior: AssistantStreamCancel;
  }): Promise<void> {
    const {
      runId,
      abortController,
      assistantMessageId,
      history,
      cancelBehavior,
    } = args;

    let lastFlush = Date.now();
    let buffer = "";
    let assistantReceivedOutput = false;
    let endedByCancel = false;

    try {
      for await (const token of streamChatCompletion({
        apiKey: effectiveAiApiKey,
        baseURL: storedOpenAiBaseUrl,
        messages: history,
        model: effectiveChatModelId,
        signal: abortController.signal,
      })) {
        if (typeof token === "string" && token.length > 0) {
          assistantReceivedOutput = true;
        }
        buffer += token;
        const now = Date.now();
        if (now - lastFlush >= 40) {
          appendAssistantToken(assistantMessageId, buffer);
          buffer = "";
          lastFlush = now;
        }
      }

      appendAssistantToken(assistantMessageId, buffer);
      buffer = "";
    } catch (e) {
      const friendly = getFriendlyChatProviderError(e);

      const isCancelled = friendly === "The request was cancelled.";
      const isActiveRun = generationRunIdRef.current === runId;
      if (isCancelled) {
        endedByCancel = true;
        if (!isActiveRun) return;

        const pendingBufferHadContent = buffer.length > 0;
        if (buffer) {
          appendAssistantToken(assistantMessageId, buffer);
          buffer = "";
        }

        const keepPartialTurn =
          assistantReceivedOutput || pendingBufferHadContent;

        if (!keepPartialTurn) {
          if (cancelBehavior.mode === "send") {
            setMessages((previous) =>
              previous.filter(
                (m) =>
                  m.id !== cancelBehavior.userMessageId &&
                  m.id !== assistantMessageId,
              ),
            );
            setText(cancelBehavior.restoreComposer);
            requestAnimationFrame(() => {
              composerInputRef.current?.focus();
            });
          } else {
            setMessages((previous) =>
              previous.filter((m) => m.id !== assistantMessageId),
            );
          }
        }

        setError(null);
        return;
      }

      setMessages((previous) =>
        previous.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `${m.content ?? ""}${m.content ? "\n\n" : ""}${friendly}`,
              }
            : m,
        ),
      );
      if (isActiveRun) setError(friendly);
    } finally {
      if (generationRunIdRef.current === runId) {
        isGeneratingRef.current = false;
        setIsGenerating(false);
      }
      if (generationRunIdRef.current === runId && !endedByCancel) {
        queueMicrotask(() => {
          void processGenerationQueue();
        });
      }
    }
  }

  async function beginRegenerateAfterEdit(
    nextBase: ChatMessageWithTime[],
  ): Promise<void> {
    if (isSessionLoading || isMigratingKey) {
      return;
    }
    if (isKeyLoading && !resolveAiApiKey(storedAiApiKey).trim()) {
      setError("API key is still loading. Try again in a moment.");
      return;
    }
    if (!effectiveAiApiKey.trim()) {
      setError("API key for your account is missing. Add it in AI settings.");
      return;
    }

    setError(null);

    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    stickToBottomRef.current = true;
    prevScrolledAwayRef.current = false;
    setShowJumpToBottomFab(false);

    const runId = ++generationRunIdRef.current;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    const assistantMessageId = makeId();
    const sentAt = Date.now();
    const assistantMsg: ChatMessageWithTime = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: sentAt,
    };

    setMessages([...nextBase, assistantMsg]);
    isGeneratingRef.current = true;
    setIsGenerating(true);

    let profileJsonForChat: string | null = storedProfileJson;
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") {
          profileJsonForChat = localStorage.getItem(profileStorageKey);
        }
      } else {
        profileJsonForChat = await SecureStore.getItemAsync(profileStorageKey);
      }
      if (profileJsonForChat !== storedProfileJson) {
        setProfileJson(profileJsonForChat);
      }
    } catch {
      // Keep in-memory profile if storage read fails.
    }

    const personalization = buildUserPersonalizationSystemMessage(
      session,
      profileJsonForChat,
    );
    const recentTurns: ChatMessage[] = nextBase
      .map(({ role, content }) => ({ role, content }))
      .slice(-10);
    const history: ChatMessage[] = personalization
      ? [personalization, ...recentTurns]
      : recentTurns;

    await runAssistantStream({
      runId,
      abortController,
      assistantMessageId,
      history,
      cancelBehavior: { mode: "edit" },
    });
  }

  async function performSendUserText(value: string): Promise<void> {
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    stickToBottomRef.current = true;
    prevScrolledAwayRef.current = false;
    setShowJumpToBottomFab(false);

    const runId = ++generationRunIdRef.current;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    const userMessageId = makeId();
    const assistantMessageId = makeId();

    const sentAt = Date.now();
    const userMsg: ChatMessageWithTime = {
      id: userMessageId,
      role: "user",
      content: value,
      createdAt: sentAt,
    };
    const assistantMsg: ChatMessageWithTime = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: sentAt,
    };

    /** Snapshot before append — `messagesRef` lags until the next render. */
    const messagesBeforeSend = messagesRef.current;

    setMessages((previous) => [...previous, userMsg, assistantMsg]);
    isGeneratingRef.current = true;
    setIsGenerating(true);

    let profileJsonForChat: string | null = storedProfileJson;
    try {
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined") {
          profileJsonForChat = localStorage.getItem(profileStorageKey);
        }
      } else {
        profileJsonForChat = await SecureStore.getItemAsync(profileStorageKey);
      }
      if (profileJsonForChat !== storedProfileJson) {
        setProfileJson(profileJsonForChat);
      }
    } catch {
      // Keep in-memory profile if storage read fails.
    }

    const personalization = buildUserPersonalizationSystemMessage(
      session,
      profileJsonForChat,
    );
    const recentTurns: ChatMessage[] = [
      ...messagesBeforeSend.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: value },
    ].slice(-10);
    const history: ChatMessage[] = personalization
      ? [personalization, ...recentTurns]
      : recentTurns;

    await runAssistantStream({
      runId,
      abortController,
      assistantMessageId,
      history,
      cancelBehavior: {
        mode: "send",
        userMessageId,
        restoreComposer: value,
      },
    });
  }

  const handleSend = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    if (isSessionLoading || isMigratingKey) {
      return;
    }

    if (isKeyLoading && !resolveAiApiKey(storedAiApiKey).trim()) {
      return;
    }

    if (!effectiveAiApiKey.trim()) {
      setError("API key for your account is missing. Add it in AI settings.");
      return;
    }

    if (isGeneratingRef.current) {
      generationQueueRef.current.push({ type: "send", userText: value });
      setPendingGenerationQueueCount(generationQueueRef.current.length);
      setText("");
      showToast({
        variant: "info",
        title: "Queued",
        message: "Your message will send after the current reply finishes.",
      });
      return;
    }

    setError(null);
    setText("");
    await performSendUserText(value);
  };

  const saveMessageEdit = () => {
    if (!messageEdit) return;
    const trimmed = messageEdit.draft.trim();
    if (!trimmed) {
      showToast({
        variant: "error",
        title: "Can’t save",
        message: "Write something first, or tap Cancel.",
      });
      return;
    }

    if (isGeneratingRef.current) {
      const prev = messagesRef.current;
      const i = prev.findIndex((m) => m.id === messageEdit.id);
      if (i === -1) {
        showToast({
          variant: "error",
          title: "Can’t update",
          message: "That message is no longer in this chat.",
        });
        closeMessageEdit();
        return;
      }
      if (prev[i].content === trimmed) {
        closeMessageEdit();
        return;
      }
      generationQueueRef.current.push({
        type: "regenerate",
        messageId: messageEdit.id,
        trimmed,
      });
      setPendingGenerationQueueCount(generationQueueRef.current.length);
      closeMessageEdit();
      showToast({
        variant: "info",
        title: "Edit queued",
        message:
          "We’ll apply your edit and regenerate after the current reply finishes.",
      });
      return;
    }

    let outcome:
      | "missing"
      | "unchanged"
      | "updated"
      | "updated_truncated" = "missing";

    let nextBase: ChatMessageWithTime[] | null = null;

    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === messageEdit.id);
      if (i === -1) {
        outcome = "missing";
        return prev;
      }
      if (prev[i].content === trimmed) {
        outcome = "unchanged";
        return prev;
      }
      const head = prev.slice(0, i);
      const updated: ChatMessageWithTime = { ...prev[i], content: trimmed };
      nextBase = [...head, updated];
      const following = prev.length - i - 1;
      outcome = following > 0 ? "updated_truncated" : "updated";
      return nextBase;
    });

    if (outcome === "missing") {
      showToast({
        variant: "error",
        title: "Can’t update",
        message: "That message is no longer in this chat.",
      });
      closeMessageEdit();
      return;
    }

    if (outcome === "unchanged") {
      closeMessageEdit();
      return;
    }

    generationRunIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    isGeneratingRef.current = false;
    setIsGenerating(false);
    setError(null);
    closeMessageEdit();

    if (outcome === "updated_truncated") {
      showToast({
        variant: "info",
        title: "Message updated",
        message: "Later replies were removed. Generating a new answer…",
      });
    } else {
      showToast({
        variant: "success",
        title: "Regenerating",
        message: "Fetching a fresh reply for your edited message…",
      });
    }

    if (nextBase) {
      void beginRegenerateAfterEdit(nextBase);
    }
  };

  useEffect(() => {
    if (!messageEdit) return;
    const t = setTimeout(() => messageEditInputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [messageEdit?.id]);

  const handleStop = () => {
    generationQueueRef.current = [];
    setPendingGenerationQueueCount(0);
    abortRef.current?.abort();
    abortRef.current = null;
    setError(null);
    isGeneratingRef.current = false;
    setIsGenerating(false);
  };

  const handleNewChat = useCallback(() => {
    const prevId = chatSessionId;
    const prevMessages = messages;

    generationRunIdRef.current += 1;
    generationQueueRef.current = [];
    setPendingGenerationQueueCount(0);
    abortRef.current?.abort();
    abortRef.current = null;
    isGeneratingRef.current = false;
    setIsGenerating(false);
    const newId = createChatSessionId();
    setChatSessionId(newId);
    setMessages([]);
    setText("");
    setError(null);
    setModelPickerOpen(false);
    setModelSearch("");
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    stickToBottomRef.current = false;
    prevScrolledAwayRef.current = false;
    jumpScrollLockUntilRef.current = 0;
    setShowJumpToBottomFab(false);
    lastScrollOffsetYRef.current = 0;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });

    void (async () => {
      if (session && historyHydrated && prevId) {
        await persistChatSession(session, {
          activeSessionId: prevId,
          currentSessionId: prevId,
          messages: prevMessages,
          modelId: effectiveChatModelId,
        });
      }
      if (session && historyHydrated) {
        await persistChatSession(session, {
          activeSessionId: newId,
          currentSessionId: newId,
          messages: [],
          modelId: effectiveChatModelId,
        });
      }
      notifyPersisted();
    })();
  }, [
    session,
    historyHydrated,
    chatSessionId,
    messages,
    effectiveChatModelId,
    notifyPersisted,
  ]);

  const { registerStartNewChat } = useChatActions();
  useEffect(() => {
    registerStartNewChat(handleNewChat);
    return () => registerStartNewChat(null);
  }, [registerStartNewChat, handleNewChat]);

  useEffect(() => {
    registerApplyHistorySession((payload) => {
      generationRunIdRef.current += 1;
      generationQueueRef.current = [];
      setPendingGenerationQueueCount(0);
      abortRef.current?.abort();
      abortRef.current = null;
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setChatSessionId(payload.sessionId);
      setMessages(payload.messages);
      setText("");
      setError(null);
      setModelPickerOpen(false);
      setModelSearch("");
      lastScrollOffsetYRef.current = 0;
      requestAnimationFrame(() => {
        snapChatListToBottom();
        requestAnimationFrame(() => {
          snapChatListToBottom();
        });
      });
    });
    return () => registerApplyHistorySession(null);
  }, [registerApplyHistorySession, snapChatListToBottom]);

  const handleShareChat = useCallback(async () => {
    if (!session || !chatSessionId || !historyHydrated) {
      showToast({
        variant: "info",
        title: "Not ready",
        message: "Wait for chat to load, then try sharing again.",
      });
      return;
    }
    try {
      await persistChatSession(session, {
        activeSessionId: chatSessionId,
        currentSessionId: chatSessionId,
        messages,
        modelId: effectiveChatModelId,
      });
      notifyPersisted();
    } catch {
      // Link is still valid; history save can retry in the background.
    }
    const url = buildChatDeepLink(chatSessionId);
    if (!url) {
      showToast({
        variant: "error",
        title: "Couldn’t build link",
        message: "Try again in a moment.",
      });
      return;
    }
    const message = `Open this chat in the app (same account & device history):\n${url}`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message, url }
          : { message },
      );
    } catch {
      showToast({
        variant: "error",
        title: "Couldn’t share",
        message: "Sharing was cancelled or failed.",
      });
    }
  }, [
    session,
    chatSessionId,
    historyHydrated,
    messages,
    effectiveChatModelId,
    notifyPersisted,
  ]);

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const handleRetryLoadModels = useCallback(() => {
    if (!effectiveAiApiKey.trim()) return;
    modelsListCacheRef.current = null;
    setModelsStatus("loading");
    setModelsErrorMessage(null);
    void listOpenAiCompatibleChatModels({
      apiKey: effectiveAiApiKey,
      baseURL: storedOpenAiBaseUrl,
    })
      .then((ids) => {
        const signature = `${effectiveAiApiKey}\0${storedOpenAiBaseUrl ?? ""}`;
        modelsListCacheRef.current = {
          signature,
          fetchedAt: Date.now(),
          ids,
        };
        setAvailableModels(ids);
        setModelsStatus("ready");
      })
      .catch((e) => {
        logChatProviderError(e, "models.list.retry");
        setModelsStatus("error");
        setModelsErrorMessage(
          e instanceof Error ? e.message : "Failed to load models.",
        );
        setAvailableModels([]);
      });
  }, [effectiveAiApiKey, storedOpenAiBaseUrl]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TabScreenHeader
        title="Chat"
        subtitle="Streaming · Private on device"
        onMenuPress={openDrawer}
        onRightPress={handleShareChat}
        rightAccessibilityLabel="Share chat link"
      />
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 8}
      >
        <View style={styles.messagesPane}>
          <FlatList
            ref={listRef}
            style={styles.messagesList}
            data={chatTimelineRows}
            extraData={{ messageCopyEnabled, pendingGenerationQueueCount }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            onMomentumScrollBegin={handleMomentumScrollBegin}
            onScrollEndDrag={updateJumpFabFromScrollEvent}
            onMomentumScrollEnd={updateJumpFabFromScrollEvent}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              scrollToEndIfPinned();
              if (
                shouldAutoScrollRef.current &&
                (stickToBottomRef.current || isGeneratingRef.current)
              ) {
                scheduleScrollToEndAfterLayout();
              }
            }}
            removeClippedSubviews={false}
            ListEmptyComponent={
              <View style={styles.emptyChatRoot}>
                <View
                  style={[
                    styles.emptyChatOrb,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      ...Platform.select({
                        ios: {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.08,
                          shadowRadius: 16,
                        },
                        android: { elevation: 3 },
                        default: {},
                      }),
                    },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "text.bubble.fill",
                      android: "chat",
                      web: "chat",
                    }}
                    size={34}
                    tintColor={colors.primary}
                  />
                </View>
                <AppText
                  style={[styles.emptyChatTitle, { color: colors.text }]}
                >
                  Start the conversation
                </AppText>
                <AppText muted style={styles.emptyChatBody}>
                  Type a message below. Answers appear word by word. Open the
                  menu anytime for a new chat or to tune AI settings.
                </AppText>
              </View>
            }
            renderItem={({ item }) =>
              item.kind === "day" ? (
                <View style={styles.daySection}>
                  <View
                    style={[
                      styles.daySectionLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <View
                    style={[
                      styles.dayPill,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        ...Platform.select({
                          ios: {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.06,
                            shadowRadius: 10,
                          },
                          android: { elevation: 4 },
                          default: {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 8,
                          },
                        }),
                      },
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "calendar",
                        android: "calendar_today",
                        web: "calendar_today",
                      }}
                      size={16}
                      tintColor={colors.primary}
                    />
                    <AppText
                      style={[
                        styles.daySectionLabel,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {item.label}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.daySectionLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.messageColumn,
                    item.role === "user"
                      ? styles.messageColumnUser
                      : styles.messageColumnAssistant,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      item.role === "user"
                        ? {
                            backgroundColor: colors.primary,
                            borderWidth: 0,
                            borderTopLeftRadius: 22,
                            borderTopRightRadius: 8,
                            borderBottomLeftRadius: 22,
                            borderBottomRightRadius: 22,
                            overflow: "hidden",
                            ...Platform.select({
                              ios: {
                                shadowColor: colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 12,
                              },
                              android: { elevation: 10 },
                              default: {
                                shadowColor: "#2563EB",
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.22,
                                shadowRadius: 10,
                              },
                            }),
                          }
                        : {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderTopLeftRadius: 8,
                            borderTopRightRadius: 22,
                            borderBottomLeftRadius: 22,
                            borderBottomRightRadius: 22,
                            overflow: "hidden",
                            ...Platform.select({
                              ios: {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.1,
                                shadowRadius: 14,
                              },
                              android: { elevation: 6 },
                              default: {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.08,
                                shadowRadius: 10,
                              },
                            }),
                          },
                    ]}
                  >
                    {item.role === "assistant" &&
                    (!item.content || item.content === "...") ? (
                      <View style={styles.thinkingRow}>
                        <ActivityIndicator
                          size="small"
                          color={colors.secondaryText as string}
                        />
                        <AppText
                          style={[
                            styles.assistantThinking,
                            { color: colors.secondaryText },
                          ]}
                        >
                          Thinking…
                        </AppText>
                      </View>
                    ) : (
                      <MarkdownMessage
                        tone={item.role === "user" ? "onPrimary" : "default"}
                        markdown={
                          item.content ||
                          (item.role === "assistant" ? "..." : "")
                        }
                      />
                    )}
                  </View>
                  {(() => {
                    const isThinkingPlaceholder =
                      item.role === "assistant" &&
                      (!item.content || item.content === "...");
                    const canCopyWhole =
                      messageCopyEnabled &&
                      !isThinkingPlaceholder &&
                      (item.content ?? "").trim().length > 0;
                    const canEditUser =
                      item.role === "user" &&
                      historyHydrated &&
                      (item.content ?? "").trim().length > 0;
                    return (
                      <View
                        style={[
                          styles.messageMetaRow,
                          item.role === "user"
                            ? styles.messageMetaRowUser
                            : styles.messageMetaRowAssistant,
                        ]}
                      >
                        {canEditUser ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Edit message"
                            hitSlop={10}
                            onPress={() =>
                              setMessageEdit({
                                id: item.id,
                                draft: item.content,
                              })
                            }
                            style={({ pressed }) => [
                              styles.messageCopyButton,
                              { opacity: pressed ? 0.65 : 1 },
                            ]}
                          >
                            <SymbolView
                              name={{
                                ios: "square.and.pencil",
                                android: "edit",
                                web: "edit",
                              }}
                              size={18}
                              tintColor={colors.secondaryText}
                            />
                          </Pressable>
                        ) : null}
                        {canCopyWhole ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Copy whole message"
                            hitSlop={10}
                            onPress={() => void copyWholeMessage(item.content)}
                            style={({ pressed }) => [
                              styles.messageCopyButton,
                              { opacity: pressed ? 0.65 : 1 },
                            ]}
                          >
                            <SymbolView
                              name={{
                                ios: "doc.on.doc",
                                android: "content_copy",
                                web: "content_copy",
                              }}
                              size={18}
                              tintColor={colors.secondaryText}
                            />
                          </Pressable>
                        ) : null}
                        <AppText
                          style={[
                            styles.messageTime,
                            {
                              color: colors.secondaryText,
                            },
                          ]}
                        >
                          {formatMessageTime(item.createdAt)}
                        </AppText>
                      </View>
                    );
                  })()}
                </View>
              )
            }
          />
        </View>

        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setBottomChromeHeight(h);
          }}
        >
          <View style={styles.composerCardOuter}>
            <View
              style={[
                styles.composerCardInner,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
            <View style={styles.composerInputRow}>
              <TextInput
                ref={composerInputRef}
                placeholder="Message the assistant…"
                placeholderTextColor={colors.placeholder as string}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                  },
                ]}
                onSubmitEditing={() => {
                  void handleSend();
                }}
                returnKeyType="default"
              />
              {isGenerating ? (
                <Pressable
                  onPress={handleStop}
                  accessibilityRole="button"
                  accessibilityLabel="Stop generating"
                  style={({ pressed }) => [
                    styles.composerStopButton,
                    {
                      backgroundColor: colors.error,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "stop.fill",
                      android: "stop",
                      web: "stop",
                    }}
                    size={18}
                    tintColor="#FFFFFF"
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void handleSend()}
                disabled={composerSubmitDisabled}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: composerSubmitDisabled
                      ? colors.border
                      : colors.primary,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                accessibilityLabel={
                  isGenerating ? "Queue message" : "Send message"
                }
              >
                <SymbolView
                  name={{
                    ios: "paperplane.fill",
                    android: "send",
                    web: "send",
                  }}
                  size={18}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>
            {pendingGenerationQueueCount > 0 ? (
              <View style={styles.composerQueueHintWrap}>
                <AppText
                  muted
                  style={[
                    styles.composerQueueHintText,
                    { color: colors.secondaryText },
                  ]}
                >
                  {pendingGenerationQueueCount === 1
                    ? "1 reply queued — sends after the current one finishes."
                    : `${pendingGenerationQueueCount} replies queued — they run in order after this one.`}
                </AppText>
              </View>
            ) : null}

            {!effectiveAiApiKey.trim() ? (
              <View style={styles.composerInlineHintWrap}>
                <AppText
                  muted
                  style={[
                    styles.composerInlineHintText,
                    { color: colors.secondaryText },
                  ]}
                >
                  Settings → AI settings → save your key, then pick a model
                  below.
                </AppText>
              </View>
            ) : modelsStatus === "error" && modelsErrorMessage ? (
              <Pressable
                onPress={handleRetryLoadModels}
                style={styles.composerInlineHintWrap}
                accessibilityRole="button"
                accessibilityLabel="Retry loading models"
              >
                <AppText
                  style={[
                    styles.composerInlineHintText,
                    { color: colors.error },
                  ]}
                  numberOfLines={2}
                >
                  Models didn’t load. Tap to retry.
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose AI model"
              accessibilityState={{ disabled: !effectiveAiApiKey.trim() }}
              onPress={() => {
                setModelSearch("");
                setModelPickerOpen(true);
              }}
              disabled={!effectiveAiApiKey.trim()}
              style={({ pressed }) => [
                styles.composerModelStrip,
                {
                  borderTopColor: colors.border,
                  opacity: !effectiveAiApiKey.trim()
                    ? 0.65
                    : pressed
                      ? 0.92
                      : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.composerModelIconWrap,
                  { backgroundColor: colors.background },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "sparkles",
                    android: "auto_awesome",
                    web: "auto_awesome",
                  }}
                  size={18}
                  tintColor={colors.primary}
                />
              </View>
              <View style={styles.composerModelTextCol}>
                <AppText
                  muted
                  style={[
                    styles.composerModelCaption,
                    { color: colors.secondaryText },
                  ]}
                >
                  Model
                </AppText>
                <AppText
                  numberOfLines={1}
                  style={[styles.composerModelName, { color: colors.text }]}
                >
                  {effectiveAiApiKey.trim()
                    ? effectiveChatModelId
                    : "Add an API key to chat"}
                </AppText>
              </View>
              {modelsStatus === "loading" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "expand_more",
                    web: "expand_more",
                  }}
                  size={18}
                  tintColor={colors.secondaryText}
                />
              )}
            </Pressable>
            </View>
          </View>

          {error ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <SymbolView
                name={{
                  ios: "exclamationmark.triangle.fill",
                  android: "warning",
                  web: "warning",
                }}
                size={20}
                tintColor={colors.primary}
              />
              <View style={styles.errorBannerTextCol}>
                <AppText
                  style={[styles.errorBannerBody, { color: colors.text }]}
                >
                  {error}
                </AppText>
                {error ===
                "API key for your account is missing. Add it in AI settings." ? (
                  <Pressable
                    onPress={() => router.push("/settings-ai")}
                    style={styles.errorBannerCta}
                    accessibilityRole="button"
                    accessibilityLabel="Open AI settings"
                  >
                    <AppText
                      style={[styles.errorBannerCtaText, { color: colors.primary }]}
                    >
                      Open AI settings
                    </AppText>
                    <SymbolView
                      name={{
                        ios: "chevron.right",
                        android: "chevron_right",
                        web: "chevron_right",
                      }}
                      size={14}
                      tintColor={colors.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <Animated.View
          collapsable={false}
          pointerEvents={showJumpToBottomFab ? "box-none" : "none"}
          style={[
            styles.jumpFabDock,
            Platform.OS === "android" ? { elevation: 32 } : null,
            {
              bottom: bottomChromeHeight + 10,
              opacity: fabOpacity,
              transform: [{ translateY: fabTranslateY }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Scrolls the chat to the newest messages with animation."
            accessibilityLabel={
              isGenerating
                ? "Scroll to bottom, reply is still generating"
                : "Scroll to bottom"
            }
            onPress={jumpToBottomAnimated}
            style={({ pressed }) => [
              styles.jumpFab,
              isGenerating ? styles.jumpFabGenerating : styles.jumpFabIdle,
              {
                backgroundColor: colors.surface,
                borderColor: isGenerating ? colors.primary : colors.border,
                opacity: pressed ? 0.88 : 1,
                ...Platform.select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isGenerating ? 0.2 : 0.14,
                    shadowRadius: isGenerating ? 14 : 12,
                  },
                  android: { elevation: isGenerating ? 14 : 12 },
                  default: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.14,
                    shadowRadius: 10,
                  },
                }),
              },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <SymbolView
                name={{
                  ios: "arrow.down.circle.fill",
                  android: "arrow_downward",
                  web: "arrow_downward",
                }}
                size={22}
                tintColor={colors.secondaryText}
              />
            )}
            <AppText
              style={[
                styles.jumpFabLabel,
                { color: isGenerating ? colors.primary : colors.text },
              ]}
              numberOfLines={1}
            >
              {isGenerating ? "Catch up" : "Latest"}
            </AppText>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>

      <Modal
        visible={modelPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModelPickerOpen(false);
          setModelSearch("");
        }}
      >
        <SafeAreaView
          style={[styles.modalRoot, { backgroundColor: colors.background }]}
        >
          {/* Fixed top: list scrolls only in modalBody below — never paints over search */}
          <View
            style={[
              styles.modalStickyTop,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextCol}>
                <AppText style={[styles.modalTitle, { color: colors.text }]}>
                  Models
                </AppText>
                <AppText muted style={styles.modalSubtitle}>
                  Pick which model receives your messages
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  setModelPickerOpen(false);
                  setModelSearch("");
                }}
                hitSlop={8}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close model picker"
              >
                <SymbolView
                  name={{ ios: "xmark.circle.fill", android: "close", web: "close" }}
                  size={28}
                  tintColor={colors.secondaryText}
                />
              </Pressable>
            </View>

            <TextInput
              placeholder="Search models…"
              placeholderTextColor={colors.placeholder as string}
              value={modelSearch}
              onChangeText={setModelSearch}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.modelSearchInput,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surface,
                },
              ]}
            />
          </View>

          <View style={styles.modalBody}>
            {modelsStatus === "loading" ? (
              <ActivityIndicator
                style={styles.modalLoading}
                color={colors.primary}
              />
            ) : modelsStatus === "error" ? (
              <View style={styles.modalErrorBox}>
                <AppText style={{ color: colors.error }}>
                  {modelsErrorMessage ?? "Could not load models."}
                </AppText>
                <Pressable
                  onPress={handleRetryLoadModels}
                  style={styles.modalRetry}
                >
                  <AppText style={{ color: colors.primary, fontWeight: "700" }}>
                    Try again
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={filteredModelIds}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                contentContainerStyle={styles.modalListContent}
                style={styles.modalModelList}
                renderItem={({ item }) => {
                  const isSelected = item === effectiveChatModelId;
                  return (
                    // Padding wrapper: keeps selected border/shadow inside layout bounds so
                    // FlatList / neighbors don't clip the bottom edge.
                    <View
                      style={[
                        styles.modelListCellWrap,
                        isSelected && styles.modelListCellWrapSelected,
                      ]}
                    >
                      <Pressable
                        onPress={() => {
                          setStoredChatModelId(item);
                          setModelPickerOpen(false);
                          setModelSearch("");
                        }}
                        style={[
                          styles.modelListRow,
                          !isSelected && {
                            borderBottomColor: colors.border,
                          },
                          isSelected && {
                            marginHorizontal: 8,
                            paddingVertical: 16,
                            paddingHorizontal: 14,
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: colors.primary,
                            backgroundColor: colors.surface,
                            borderBottomWidth: 2,
                            // Subtle emphasis so it reads even if surface ≈ background
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.12,
                            shadowRadius: 3,
                            elevation: 3,
                          },
                        ]}
                      >
                        <AppText
                          style={[
                            styles.modelListRowText,
                            {
                              color: isSelected ? colors.primary : colors.text,
                              fontWeight: isSelected ? "800" : "500",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {item}
                        </AppText>
                        {isSelected ? (
                          <View
                            style={[
                              styles.modelSelectedCheckWrap,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <SymbolView
                              name={{
                                ios: "checkmark",
                                android: "check",
                                web: "check",
                              }}
                              size={14}
                              tintColor="#FFFFFF"
                            />
                          </View>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <AppText muted style={styles.modalEmpty}>
                    {modelSearch.trim()
                      ? "No models match your search."
                      : "No models returned from the provider."}
                  </AppText>
                }
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={messageEdit !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeMessageEdit}
      >
        <SafeAreaView
          style={[styles.modalRoot, { backgroundColor: colors.background }]}
          edges={["top", "left", "right"]}
        >
          <KeyboardAvoidingView
            style={styles.editMessageKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            <View
              style={[
                styles.editMessageHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.modalHeaderTextCol}>
                <AppText style={[styles.modalTitle, { color: colors.text }]}>
                  Edit message
                </AppText>
                <AppText muted style={styles.modalSubtitle}>
                  Saving removes any messages after this one (including a reply
                  that’s still loading) so the thread stays consistent.
                </AppText>
              </View>
              <Pressable
                onPress={closeMessageEdit}
                hitSlop={8}
                style={styles.modalCloseBtn}
                accessibilityLabel="Cancel editing"
              >
                <SymbolView
                  name={{
                    ios: "xmark.circle.fill",
                    android: "close",
                    web: "close",
                  }}
                  size={28}
                  tintColor={colors.secondaryText}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editMessageScrollContent}
              style={styles.editMessageScroll}
            >
              <TextInput
                ref={messageEditInputRef}
                value={messageEdit?.draft ?? ""}
                onChangeText={(t) =>
                  setMessageEdit((s) => (s ? { ...s, draft: t } : null))
                }
                multiline
                textAlignVertical="top"
                placeholder="Your message…"
                placeholderTextColor={colors.placeholder as string}
                style={[
                  styles.editMessageInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
            </ScrollView>

            <View
              style={[
                styles.editMessageActions,
                {
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(safeInsets.bottom, 14),
                },
              ]}
            >
              <Pressable
                onPress={closeMessageEdit}
                style={({ pressed }) => [
                  styles.editMessageSecondaryBtn,
                  {
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityLabel="Cancel"
              >
                <AppText
                  style={[styles.editMessageSecondaryLabel, { color: colors.text }]}
                >
                  Cancel
                </AppText>
              </Pressable>
              <Pressable
                onPress={saveMessageEdit}
                style={({ pressed }) => [
                  styles.editMessagePrimaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityLabel="Save message"
              >
                <AppText style={styles.editMessagePrimaryLabel}>Save</AppText>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardRoot: {
    flex: 1,
    position: "relative",
  },
  messagesPane: {
    flex: 1,
    minHeight: 0,
  },
  messagesList: {
    flex: 1,
  },
  /** Docked above measured composer stack so the native list can’t paint over the pill (Android). */
  jumpFabDock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  jumpFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  jumpFabGenerating: {
    borderWidth: 2,
  },
  jumpFabIdle: {
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  jumpFabLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  emptyChatRoot: {
    flexGrow: 1,
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 16,
  },
  emptyChatOrb: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptyChatBody: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
    flexGrow: 1,
  },
  daySection: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    width: "100%",
    gap: 12,
  },
  daySectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.55,
  },
  dayPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "78%",
  },
  daySectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  messageColumn: {
    maxWidth: "90%",
    gap: 8,
  },
  messageColumnUser: {
    alignSelf: "flex-end",
    paddingLeft: 36,
  },
  messageColumnAssistant: {
    alignSelf: "flex-start",
    paddingRight: 36,
  },
  messageBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  assistantThinking: {
    fontSize: 15,
    fontStyle: "italic",
    fontWeight: "600",
    lineHeight: 22,
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  messageMetaRowUser: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  messageMetaRowAssistant: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  messageCopyButton: {
    padding: 4,
    borderRadius: 8,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 4,
    opacity: 0.85,
    fontVariant: ["tabular-nums"],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorBannerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  errorBannerBody: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  errorBannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  errorBannerCtaText: {
    fontSize: 15,
    fontWeight: "800",
  },
  /**
   * Outer: shadow / elevation only — no overflow:hidden so iOS draws the shadow.
   * Inner: clips children to the same corner radius.
   */
  composerCardOuter: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
    }),
  },
  composerCardInner: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerModelStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerModelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  composerModelTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  composerModelCaption: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  composerModelName: {
    fontSize: 15,
    fontWeight: "800",
  },
  composerInlineHintWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  composerInlineHintText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  composerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    paddingVertical: 10,
    paddingRight: 4,
    minHeight: 48,
    maxHeight: 140,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  composerStopButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  composerQueueHintWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 2,
  },
  composerQueueHintText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  modalRoot: {
    flex: 1,
  },
  /** Title + search: opaque layer above the list so scrolled rows don’t show through. */
  modalStickyTop: {
    zIndex: 2,
    elevation: 6,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /** Scrollable list (and loading/error) only occupy space below the search bar. */
  modalBody: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  modalHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  modalCloseBtn: {
    marginTop: 2,
    padding: 4,
  },
  modelSearchInput: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  modalLoading: {
    marginTop: 24,
  },
  modalErrorBox: {
    padding: 16,
    gap: 12,
  },
  modalRetry: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  modalListContent: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  modalModelList: {
    flex: 1,
  },
  modelListCellWrap: {
    overflow: "visible",
  },
  /** Vertical inset so the selected card’s bottom border isn’t flush with the next row. */
  modelListCellWrapSelected: {
    paddingVertical: 8,
  },
  modelListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelListRowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  modelSelectedCheckWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEmpty: {
    padding: 20,
    textAlign: "center",
  },
  editMessageKeyboard: {
    flex: 1,
  },
  editMessageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editMessageScroll: {
    flex: 1,
    minHeight: 0,
  },
  editMessageScrollContent: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  editMessageInput: {
    minHeight: 160,
    maxHeight: 360,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  editMessageActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editMessageSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editMessageSecondaryLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  editMessagePrimaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    minWidth: 100,
    alignItems: "center",
  },
  editMessagePrimaryLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

