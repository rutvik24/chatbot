import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
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
  type ChatMessage,
  streamChatCompletion,
} from "@/services/openrouter-chat";
import { resolveOpenRouterApiKey } from "@/utils/openrouter-env-defaults";
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getOpenAiCompatibleBaseUrlStorageKey,
  getOpenRouterApiKeyStorageKey,
} from "@/utils/openrouter-storage";
import { getFriendlyChatProviderError } from "@/utils/provider-chat-error";
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
  const [messages, setMessages] = useState<
    { id: string; role: ChatMessage["role"]; content: string }[]
  >([]);
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
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] =
    useStorageState(storageKey);
  const [[, storedOpenAiBaseUrl], setOpenAiBaseUrl] =
    useStorageState(baseUrlStorageKey);
  const [[, storedProfileJson], setProfileJson] =
    useStorageState(profileStorageKey);
  const effectiveOpenRouterKey = useMemo(
    () => resolveOpenRouterApiKey(storedOpenRouterKey),
    [storedOpenRouterKey],
  );

  const [error, setError] = useState<string | null>(null);
  const [isMigratingKey, setIsMigratingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const isAtBottomRef = useRef(true);
  const listRef =
    useRef<
      FlatList<{ id: string; role: ChatMessage["role"]; content: string }>
    >(null);

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
  }, [messages.length]);

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
            if (isActive) {
              setOpenRouterKey(keyNext);
              setOpenAiBaseUrl(urlNext);
              setProfileJson(profileNext);
            }
            return;
          }

          const [keyNext, urlNext, profileNext] = await Promise.all([
            SecureStore.getItemAsync(storageKey),
            SecureStore.getItemAsync(baseUrlStorageKey),
            SecureStore.getItemAsync(profileStorageKey),
          ]);
          if (isActive) {
            setOpenRouterKey(keyNext);
            setOpenAiBaseUrl(urlNext);
            setProfileJson(profileNext);
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
      profileStorageKey,
      setOpenAiBaseUrl,
      setOpenRouterKey,
      setProfileJson,
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

    // Cancel any in-flight request.
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    const userMessageId = makeId();
    const assistantMessageId = makeId();

    const userMsg = {
      id: userMessageId,
      role: "user" as const,
      content: value,
    };
    const assistantMsg = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
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

    try {
      let lastFlush = Date.now();
      let buffer = "";

      for await (const token of streamChatCompletion({
        apiKey: effectiveOpenRouterKey,
        baseURL: storedOpenAiBaseUrl,
        messages: history,
        model: "openrouter/free",
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
      setMessages((previous) =>
        previous.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: `\n\n${friendly}` }
            : m,
        ),
      );
      setError(friendly);
    } finally {
      setIsGenerating(false);
    }
  };

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
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={50}
          onScrollBeginDrag={() => {
            // User started interacting; stop forcing scroll until they return to bottom.
            shouldAutoScrollRef.current = false;
          }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  alignSelf: item.role === "user" ? "flex-end" : "flex-start",
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
          )}
        />

        <View
          style={[
            styles.composer,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
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
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendButton,
              {
                backgroundColor: canSend ? colors.primary : colors.border,
              },
            ]}
          >
            <SymbolView
              name={{ ios: "paperplane.fill", android: "send", web: "send" }}
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
  messageBubble: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: "85%",
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
});

