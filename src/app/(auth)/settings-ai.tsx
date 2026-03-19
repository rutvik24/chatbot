import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, AppText, AppTextInput } from "@/components/common";
import { useSession } from "@/ctx/auth-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useStorageState } from "@/hooks/use-storage-state";
import {
  DEFAULT_OPENAI_COMPAT_BASE_URL,
  normalizeOpenAiCompatibleBaseUrl,
} from "@/services/openrouter-chat";
import { hasEnvDefaultOpenRouterApiKey } from "@/utils/openrouter-env-defaults";
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getOpenAiCompatibleBaseUrlStorageKey,
  getOpenRouterApiKeyStorageKey,
} from "@/utils/openrouter-storage";

export default function SettingsAiScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session, isLoading: isSessionLoading } = useSession();
  const storageKey = useMemo(
    () => getOpenRouterApiKeyStorageKey(session),
    [session],
  );
  const baseUrlStorageKey = useMemo(
    () => getOpenAiCompatibleBaseUrlStorageKey(session),
    [session],
  );
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] =
    useStorageState(storageKey);
  const [[isBaseUrlLoading, storedBaseUrl], setStoredBaseUrl] =
    useStorageState(baseUrlStorageKey);

  const [input, setInput] = useState(storedOpenRouterKey ?? "");
  const [baseUrlInput, setBaseUrlInput] = useState(
    storedBaseUrl ?? DEFAULT_OPENAI_COMPAT_BASE_URL,
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInput(storedOpenRouterKey ?? "");
  }, [storedOpenRouterKey, storageKey]);

  useEffect(() => {
    setBaseUrlInput(storedBaseUrl ?? DEFAULT_OPENAI_COMPAT_BASE_URL);
  }, [storedBaseUrl, baseUrlStorageKey]);

  useEffect(() => {
    // Migrate old global key -> per-user key once, then drop legacy so clear
    // cannot be undone by this effect re-running.
    if (isKeyLoading) return;
    if (isSessionLoading) return;
    if (!session) return;
    if (storageKey === GLOBAL_API_KEY_STORAGE_KEY) return;
    if (storedOpenRouterKey) return;

    let cancelled = false;
    (async () => {
      try {
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
      } catch {
        // Ignore migration failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isKeyLoading,
    isSessionLoading,
    session,
    storageKey,
    storedOpenRouterKey,
    setOpenRouterKey,
  ]);

  const saveOpenRouterKey = () => {
    if (isSessionLoading || !session) {
      setMessage("Please sign in before saving your API key.");
      return;
    }
    if (!input.trim()) {
      setMessage("Please enter a valid OpenRouter API key.");
      return;
    }
    setOpenRouterKey(input.trim());
    setMessage("OpenRouter API key saved securely for your account.");
  };

  const clearOpenRouterKey = async () => {
    // Remove global slot first so the migration effect cannot repopulate the field.
    await clearGlobalApiKeyStorage();
    setOpenRouterKey(null);
    setInput("");
    setMessage("OpenRouter API key cleared for your account.");
  };

  const saveBaseUrl = () => {
    if (isSessionLoading || !session) {
      setMessage("Please sign in before saving the base URL.");
      return;
    }
    try {
      const normalized = normalizeOpenAiCompatibleBaseUrl(baseUrlInput);
      if (normalized === DEFAULT_OPENAI_COMPAT_BASE_URL) {
        setStoredBaseUrl(null);
        setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
        setMessage("Using default OpenRouter base URL.");
        return;
      }
      setStoredBaseUrl(normalized);
      setBaseUrlInput(normalized);
      setMessage("Base URL saved.");
    } catch {
      setMessage("Enter a valid URL (https://…), e.g. OpenRouter or a proxy.");
    }
  };

  const resetBaseUrlToDefault = () => {
    setStoredBaseUrl(null);
    setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
    setMessage("Reset to default OpenRouter base URL.");
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 8}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AppText style={styles.title}>AI settings</AppText>
          <AppText muted>
            {isKeyLoading || isBaseUrlLoading
              ? "Loading settings..."
              : "API key and base URL are stored locally using secure storage on native. If no key is saved, the app can use EXPO_PUBLIC_OPENROUTER_API_KEY (or EXPO_PUBLIC_OPENAI_API_KEY) from your env at build time."}
          </AppText>

          <AppTextInput
            label="OpenAI-compatible base URL"
            value={baseUrlInput}
            onChangeText={setBaseUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={DEFAULT_OPENAI_COMPAT_BASE_URL}
            returnKeyType="done"
            onSubmitEditing={saveBaseUrl}
          />
          <AppText muted style={styles.hint}>
            Default is OpenRouter. Use another host for a custom gateway or
            OpenAI-compatible API. The chat screen still uses the model id
            openrouter/free—other hosts may need a different model in code.
          </AppText>
          <View style={styles.buttonRow}>
            <AppButton
              label="Save base URL"
              onPress={saveBaseUrl}
              style={styles.rowButton}
            />
            <AppButton
              label="Default URL"
              variant="secondary"
              onPress={resetBaseUrlToDefault}
              style={styles.rowButton}
            />
          </View>

          <AppTextInput
            label="API key"
            value={input}
            onChangeText={setInput}
            isPasswordField
            placeholder="sk-or-v1-..."
            returnKeyType="done"
            onSubmitEditing={saveOpenRouterKey}
          />
          {!isKeyLoading &&
          !storedOpenRouterKey?.trim() &&
          hasEnvDefaultOpenRouterApiKey() ? (
            <AppText muted style={styles.hint}>
              No key saved for this account. Chat will use the default API key
              from your Expo public env until you save one here.
            </AppText>
          ) : null}

          <View style={styles.buttonRow}>
            <AppButton
              label="Save API key"
              onPress={saveOpenRouterKey}
              style={styles.rowButton}
            />
            <AppButton
              label="Clear API key"
              variant="secondary"
              onPress={clearOpenRouterKey}
              style={styles.rowButton}
            />
          </View>

          {message ? (
            <AppText style={[styles.message, { color: colors.primary }]}>
              {message}
            </AppText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
    alignItems: "stretch",
  },
  title: { fontSize: 26, fontWeight: "700" },
  message: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 13, lineHeight: 18 },
  buttonRow: {
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "stretch",
    gap: 8,
    width: "100%",
  },
  rowButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 8,
  },
});
