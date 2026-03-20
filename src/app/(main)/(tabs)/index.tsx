import {
  DrawerActions,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
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
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import MarkdownMessage from "@/components/markdown-message";
import { TabScreenHeader } from "@/components/tab-screen-header";
import { useChatActions } from "@/ctx/chat-actions-context";
import { useSession } from "@/ctx/auth-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useStorageState } from "@/hooks/use-storage-state";
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
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessageWithTime[]>([]);
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
  const chatTimelineRows = useMemo(
    () => buildChatTimelineRows(messages),
    [messages],
  );

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

  const canSend = useMemo(
    () =>
      text.trim().length > 0 &&
      !isGenerating &&
      !isSessionLoading &&
      !isMigratingKey &&
      !!effectiveAiApiKey.trim(),
    [
      text,
      isGenerating,
      isSessionLoading,
      isMigratingKey,
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

      return () => {
        isActive = false;
      };
    }, [
      baseUrlStorageKey,
      modelStorageKey,
      profileStorageKey,
      setOpenAiBaseUrl,
      setAiApiKey,
      setProfileJson,
      setStoredChatModelId,
      storageKey,
    ]),
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

  const handleSend = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    if (isSessionLoading || isMigratingKey) {
      return;
    }

    // Wait for key storage unless an env default is available.
    if (isKeyLoading && !resolveAiApiKey(storedAiApiKey).trim()) {
      return;
    }

    if (!effectiveAiApiKey.trim()) {
      setError("API key for your account is missing. Add it in AI settings.");
      return;
    }

    setError(null);

    // Pin to bottom for the whole reply (same idea as “Catch up” during streaming).
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;
    stickToBottomRef.current = true;
    prevScrolledAwayRef.current = false;
    setShowJumpToBottomFab(false);

    const runId = ++generationRunIdRef.current;

    // Cancel any in-flight request.
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

    setMessages((previous) => [...previous, userMsg, assistantMsg]);
    setText("");
    setIsGenerating(true);

    // Re-read Profile from storage so name/email match what the user just saved
    // (React state can lag until the tab regains focus).
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

    // Recent turns + system context from Profile + session (authoritative user facts).
    const personalization = buildUserPersonalizationSystemMessage(
      session,
      profileJsonForChat,
    );
    const recentTurns: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: value },
    ].slice(-10);
    const history: ChatMessage[] = personalization
      ? [personalization, ...recentTurns]
      : recentTurns;

    let lastFlush = Date.now();
    let buffer = "";
    /** Any non-empty token from the model (used on Stop: discard turn vs keep partial). */
    let assistantReceivedOutput = false;

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

      // When the user presses "Stop", we abort the request. In that case,
      // avoid injecting a cancellation error message into the assistant.
      const isCancelled = friendly === "The request was cancelled.";
      const isActiveRun = generationRunIdRef.current === runId;
      if (isCancelled) {
        if (!isActiveRun) return;

        const pendingBufferHadContent = buffer.length > 0;
        if (buffer) {
          appendAssistantToken(assistantMessageId, buffer);
          buffer = "";
        }

        const keepPartialTurn =
          assistantReceivedOutput || pendingBufferHadContent;

        if (!keepPartialTurn) {
          setMessages((previous) =>
            previous.filter(
              (m) => m.id !== userMessageId && m.id !== assistantMessageId,
            ),
          );
        }

        setError(null);
        if (!keepPartialTurn) {
          setText(value);
          requestAnimationFrame(() => {
            composerInputRef.current?.focus();
          });
        }
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
      if (generationRunIdRef.current === runId) setIsGenerating(false);
    }
  };

  const handleStop = () => {
    // Stop streaming / generation immediately.
    abortRef.current?.abort();
    abortRef.current = null;
    setError(null);
    setIsGenerating(false);
  };

  const handleNewChat = useCallback(() => {
    generationRunIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
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
  }, []);

  const { registerStartNewChat } = useChatActions();
  useEffect(() => {
    registerStartNewChat(handleNewChat);
    return () => registerStartNewChat(null);
  }, [registerStartNewChat, handleNewChat]);

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
                  <AppText
                    style={[
                      styles.messageTime,
                      {
                        color: colors.secondaryText,
                        textAlign: item.role === "user" ? "right" : "left",
                      },
                    ]}
                  >
                    {formatMessageTime(item.createdAt)}
                  </AppText>
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
                  if (isGenerating) return;
                  void handleSend();
                }}
                returnKeyType="default"
              />
              <Pressable
                onPress={isGenerating ? handleStop : handleSend}
                disabled={!isGenerating && !canSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: isGenerating
                      ? colors.error
                      : canSend
                        ? colors.primary
                        : colors.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <SymbolView
                  name={
                    isGenerating
                      ? { ios: "stop.fill", android: "stop", web: "stop" }
                      : { ios: "paperplane.fill", android: "send", web: "send" }
                  }
                  size={18}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>

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
  messageTime: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
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
});

