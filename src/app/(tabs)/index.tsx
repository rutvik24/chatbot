import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import MarkdownMessage from "@/components/markdown-message";
import { useSession } from "@/ctx/auth-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useStorageState } from "@/hooks/use-storage-state";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatMessage,
  listOpenAiCompatibleChatModels,
  streamChatCompletion,
} from "@/services/openrouter-chat";
import { resolveOpenRouterApiKey } from "@/utils/openrouter-env-defaults";
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getChatModelIdStorageKey,
  getOpenAiCompatibleBaseUrlStorageKey,
  getOpenRouterApiKeyStorageKey,
} from "@/utils/openrouter-storage";
import {
  getFriendlyChatProviderError,
  logChatProviderError,
} from "@/utils/provider-chat-error";
import {
  buildChatTimelineRows,
  formatMessageTime,
  type ChatMessageWithTime,
  type ChatTimelineRow,
} from "@/utils/chat-timeline";
import {
  buildUserPersonalizationSystemMessage,
  getUserProfileStorageKey,
} from "@/utils/user-profile-chat";

export default function HomeScreen() {
  useColorScheme();
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const colors = useNativeThemeColors();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessageWithTime[]>([]);
  const storageKey = useMemo(
    () => getOpenRouterApiKeyStorageKey(session),
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
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] =
    useStorageState(storageKey);
  const [[, storedOpenAiBaseUrl], setOpenAiBaseUrl] =
    useStorageState(baseUrlStorageKey);
  const [[, storedProfileJson], setProfileJson] =
    useStorageState(profileStorageKey);
  const [[, storedChatModelId], setStoredChatModelId] =
    useStorageState(modelStorageKey);
  const effectiveOpenRouterKey = useMemo(
    () => resolveOpenRouterApiKey(storedOpenRouterKey),
    [storedOpenRouterKey],
  );
  const effectiveChatModelId = useMemo(() => {
    const t = storedChatModelId?.trim();
    return t && t.length > 0 ? t : DEFAULT_CHAT_MODEL_ID;
  }, [storedChatModelId]);

  const [error, setError] = useState<string | null>(null);
  const [isMigratingKey, setIsMigratingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const isAtBottomRef = useRef(true);
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
  }, [effectiveOpenRouterKey, storedOpenAiBaseUrl]);

  const canSend = useMemo(
    () =>
      text.trim().length > 0 &&
      !isGenerating &&
      !isSessionLoading &&
      !isMigratingKey &&
      !!effectiveOpenRouterKey.trim(),
    [
      text,
      isGenerating,
      isSessionLoading,
      isMigratingKey,
      effectiveOpenRouterKey,
    ],
  );

  useEffect(() => {
    if (!listRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  }, [chatTimelineRows.length]);

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distanceFromBottom <= 24;
    isAtBottomRef.current = atBottom;
    shouldAutoScrollRef.current = atBottom;
  };

  useEffect(() => {
    if (effectiveOpenRouterKey.trim()) {
      setError(null);
    }
  }, [effectiveOpenRouterKey]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    if (
      !effectiveOpenRouterKey.trim() ||
      isKeyLoading ||
      isSessionLoading
    ) {
      return;
    }

    const signature = `${effectiveOpenRouterKey}\0${storedOpenAiBaseUrl ?? ""}`;
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
          apiKey: effectiveOpenRouterKey,
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
    effectiveOpenRouterKey,
    storedOpenAiBaseUrl,
    isKeyLoading,
    isSessionLoading,
  ]);

  const filteredModelIds = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    let list = [...availableModels];
    if (
      effectiveChatModelId &&
      !list.includes(effectiveChatModelId)
    ) {
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
    if (storedOpenRouterKey) return; // per-user key already exists

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
          setOpenRouterKey(next);
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
    storedOpenRouterKey,
    setOpenRouterKey,
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
              setOpenRouterKey(keyNext);
              setOpenAiBaseUrl(urlNext);
              setProfileJson(profileNext);
              setStoredChatModelId(modelNext);
            }
            return;
          }

          const [keyNext, urlNext, profileNext, modelNext] =
            await Promise.all([
              SecureStore.getItemAsync(storageKey),
              SecureStore.getItemAsync(baseUrlStorageKey),
              SecureStore.getItemAsync(profileStorageKey),
              SecureStore.getItemAsync(modelStorageKey),
            ]);
          if (isActive) {
            setOpenRouterKey(keyNext);
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
      setOpenRouterKey,
      setProfileJson,
      setStoredChatModelId,
      storageKey,
    ]),
  );

  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const appendAssistantToken = (assistantId: string, tokenBuffer: string) => {
    if (!tokenBuffer) return;
    setMessages((previous) =>
      previous.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + tokenBuffer } : m,
      ),
    );
    // Only auto-scroll when user is already at the bottom.
    if (!shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    if (isSessionLoading || isMigratingKey) {
      return;
    }

    // Reset to default behavior: when user sends a new message, we should
    // auto-scroll back to the end and keep streaming in view.
    shouldAutoScrollRef.current = true;
    isAtBottomRef.current = true;

    // Wait for key storage unless an env default is available.
    if (isKeyLoading && !resolveOpenRouterApiKey(storedOpenRouterKey).trim()) {
      return;
    }

    if (!effectiveOpenRouterKey.trim()) {
      setError("OpenRouter API key for your account is missing. Add it now.");
      return;
    }

    setError(null);

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

    try {
      for await (const token of streamChatCompletion({
        apiKey: effectiveOpenRouterKey,
        baseURL: storedOpenAiBaseUrl,
        messages: history,
        model: effectiveChatModelId,
        signal: abortController.signal,
      })) {
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

        // Keep already-streamed assistant content.
        // Also flush any remaining buffer so the last chunk isn't lost.
        if (buffer) {
          appendAssistantToken(assistantMessageId, buffer);
          buffer = "";
        }

        setError(null);
        // Restore the composer text so the user can edit/resend quickly.
        setText(value);
        requestAnimationFrame(() => {
          composerInputRef.current?.focus();
        });
        return;
      }

      setMessages((previous) =>
        previous.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: `${m.content ?? ""}${m.content ? "\n\n" : ""}${friendly}` }
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

  const handleRetryLoadModels = useCallback(() => {
    if (!effectiveOpenRouterKey.trim()) return;
    modelsListCacheRef.current = null;
    setModelsStatus("loading");
    setModelsErrorMessage(null);
    void listOpenAiCompatibleChatModels({
      apiKey: effectiveOpenRouterKey,
      baseURL: storedOpenAiBaseUrl,
    })
      .then((ids) => {
        const signature = `${effectiveOpenRouterKey}\0${storedOpenAiBaseUrl ?? ""}`;
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
  }, [effectiveOpenRouterKey, storedOpenAiBaseUrl]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 8}
      >
        <FlatList
          ref={listRef}
          data={chatTimelineRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={50}
          onScrollBeginDrag={() => {
            // User started interacting; stop forcing scroll until they return to bottom.
            shouldAutoScrollRef.current = false;
          }}
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
                    },
                  ]}
                >
                  <AppText
                    muted
                    style={[styles.daySectionLabel, { color: colors.secondaryText }]}
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
                    ? { alignSelf: "flex-end" }
                    : { alignSelf: "flex-start" },
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderTopLeftRadius: item.role === "user" ? 16 : 2,
                      borderTopRightRadius: item.role === "user" ? 2 : 16,
                      borderBottomLeftRadius: 16,
                      borderBottomRightRadius: 16,
                    },
                  ]}
                >
                  <MarkdownMessage
                    markdown={
                      item.content || (item.role === "assistant" ? "..." : "")
                    }
                  />
                </View>
                <AppText
                  muted
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

        <View style={styles.modelRowWrap}>
          <Pressable
            onPress={() => {
              setModelSearch("");
              setModelPickerOpen(true);
            }}
            disabled={!effectiveOpenRouterKey.trim()}
            style={[
              styles.modelPickerTrigger,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: effectiveOpenRouterKey.trim() ? 1 : 0.55,
              },
            ]}
          >
            <AppText
              numberOfLines={1}
              style={[styles.modelPickerLabel, { color: colors.text }]}
            >
              {effectiveChatModelId}
            </AppText>
            {modelsStatus === "loading" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <SymbolView
                name={{
                  ios: "chevron.down",
                  android: "expand_more",
                  web: "expand_more",
                }}
                size={16}
                tintColor={colors.secondaryText}
              />
            )}
          </Pressable>
          {!effectiveOpenRouterKey.trim() ? (
            <AppText muted style={styles.modelHint}>
              Add an API key in Settings → AI settings to load models.
            </AppText>
          ) : modelsStatus === "error" && modelsErrorMessage ? (
            <AppText
              style={[styles.modelHint, { color: colors.error }]}
              numberOfLines={2}
            >
              {modelsErrorMessage}
            </AppText>
          ) : null}
        </View>

        <View
          style={[
            styles.composer,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
            ref={composerInputRef}
            placeholder="Type a message..."
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
            returnKeyType="send"
          />
          <Pressable
            onPress={isGenerating ? handleStop : handleSend}
            disabled={!isGenerating && !canSend}
            style={[
              styles.sendButton,
              {
                backgroundColor: isGenerating
                  ? colors.error
                  : canSend
                    ? colors.primary
                    : colors.border,
              },
            ]}
          >
            <SymbolView
              name={
                isGenerating
                  ? { ios: "stop.fill", android: "stop", web: "stop" }
                  : { ios: "paperplane.fill", android: "send", web: "send" }
              }
              size={16}
              tintColor="#FFFFFF"
            />
          </Pressable>
        </View>

        {error ? (
          <AppText style={[styles.errorText, { color: colors.primary }]}>
            {error}
          </AppText>
        ) : null}
        {error ===
        "OpenRouter API key for your account is missing. Add it now." ? (
          <Pressable
            onPress={() => router.push("/settings-ai")}
            style={styles.errorLink}
          >
            <AppText style={[styles.errorLinkText, { color: colors.primary }]}>
              Enter API key
            </AppText>
          </Pressable>
        ) : null}
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
              <AppText style={[styles.modalTitle, { color: colors.text }]}>
                Select model
              </AppText>
              <Pressable
                onPress={() => {
                  setModelPickerOpen(false);
                  setModelSearch("");
                }}
                hitSlop={8}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={18}
                  tintColor={colors.text}
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
                            weight="bold"
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
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  daySection: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
    gap: 10,
  },
  daySectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.85,
  },
  dayPill: {
    flexShrink: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "72%",
  },
  daySectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  messageColumn: {
    maxWidth: "85%",
    gap: 4,
  },
  messageBubble: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  errorText: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 13,
    fontWeight: "600",
  },
  errorLink: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  errorLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  composer: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 48,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modelRowWrap: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 6,
  },
  modelPickerTrigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modelPickerLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  modelHint: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2,
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
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  modelSearchInput: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
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

