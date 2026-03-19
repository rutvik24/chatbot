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
  Text,
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
import { getOpenRouterApiKeyStorageKey } from "@/utils/openrouter-storage";
import { subscribeToast, type Toast } from "@/utils/toast-bus";

export default function HomeScreen() {
  useColorScheme();
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const colors = useNativeThemeColors();
  const [text, setText] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<
    { id: string; role: ChatMessage["role"]; content: string }[]
  >([]);
  const storageKey = useMemo(
    () => getOpenRouterApiKeyStorageKey(session),
    [session],
  );
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] =
    useStorageState(storageKey);
  const openRouterKey = storedOpenRouterKey ?? "";

  const [error, setError] = useState<string | null>(null);
  const [isMigratingKey, setIsMigratingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef =
    useRef<
      FlatList<{ id: string; role: ChatMessage["role"]; content: string }>
    >(null);

  const canSend = useMemo(
    () =>
      text.trim().length > 0 &&
      !isGenerating &&
      !isKeyLoading &&
      !isSessionLoading &&
      !isMigratingKey &&
      !!openRouterKey,
    [
      text,
      isGenerating,
      isKeyLoading,
      isSessionLoading,
      isMigratingKey,
      openRouterKey,
    ],
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  }, [messages.length, isGenerating]);

  useEffect(() => {
    if (openRouterKey) {
      setError(null);
    }
  }, [openRouterKey]);

  useEffect(() => {
    const unsubscribe = subscribeToast((message) => {
      setToast(message);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, message.durationMs ?? 1200);
    });

    return () => {
      unsubscribe();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [setToast]);

  useEffect(() => {
    // Migrate old global key -> per-user key once.
    const OLD_KEY = "openrouter-api-key";
    if (isKeyLoading) return;
    if (!session) return;
    if (storageKey === OLD_KEY) return;
    if (storedOpenRouterKey) return; // per-user key already exists

    let cancelled = false;
    (async () => {
      try {
        setIsMigratingKey(true);
        const next =
          Platform.OS === "web"
            ? typeof localStorage !== "undefined"
              ? localStorage.getItem(OLD_KEY)
              : null
            : await SecureStore.getItemAsync(OLD_KEY);

        if (!cancelled && next) {
          setOpenRouterKey(next);
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
            const next =
              typeof localStorage !== "undefined"
                ? localStorage.getItem(storageKey)
                : null;
            if (isActive) setOpenRouterKey(next);
            return;
          }

          const next = await SecureStore.getItemAsync(storageKey);
          if (isActive) setOpenRouterKey(next);
        } catch {
          // Ignore refresh errors; the user can still enter a new key.
        }
      };

      refreshKey();

      return () => {
        isActive = false;
      };
    }, [setOpenRouterKey, storageKey]),
  );

  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const appendAssistantToken = (assistantId: string, tokenBuffer: string) => {
    if (!tokenBuffer) return;
    setMessages((previous) =>
      previous.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + tokenBuffer } : m,
      ),
    );
    // Keep the newest streamed tokens in view.
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    if (isKeyLoading || isSessionLoading || isMigratingKey) {
      // Storage is still loading; avoid showing a false "missing key" error.
      return;
    }

    if (!openRouterKey) {
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

    // Use the existing conversation as context (small cap to keep costs down).
    const history: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: value },
    ].slice(-10);

    try {
      let lastFlush = Date.now();
      let buffer = "";

      for await (const token of streamChatCompletion({
        apiKey: openRouterKey,
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
      const message = (e as any)?.message;
      const friendly =
        typeof message === "string" && message
          ? message
          : "Failed to generate a response.";
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

        {toast ? (
          <View
            pointerEvents="box-none"
            style={styles.toast}
          >
            <View style={styles.toastInner}>
              <Text style={[styles.toastIcon, { color: colors.primary }]}>✓</Text>
              <Text style={styles.toastText}>{toast.message}</Text>

              {toast.action ? (
                <Pressable
                  onPress={() => {
                    toast.action?.onPress();
                    setToast(null);
                  }}
                  style={styles.toastActionButton}
                >
                  <Text style={styles.toastActionText}>{toast.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.placeholder as string}
            value={text}
            onChangeText={setText}
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
            onPress={() => router.push("/settings-openrouter")}
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
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 86,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 0,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    // Make the toast float above content.
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: "#323232",
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  toastIcon: {
    fontSize: 16,
    fontWeight: "900",
    marginRight: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.1,
    color: "#FFFFFF",
    flex: 1,
  },
  toastActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toastActionText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4FA3FF",
    letterSpacing: 0.1,
  },
  composer: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
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
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

