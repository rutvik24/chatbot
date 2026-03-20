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
  coerceOpenAiCompatibleBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "@/services/openai-compatible-chat";
import { hasEnvDefaultAiApiKey } from "@/utils/ai-api-key-env";
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getAiApiKeyStorageKey,
  getOpenAiCompatibleBaseUrlStorageKey,
} from "@/utils/ai-credentials-storage";

export default function SettingsAiScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session, isLoading: isSessionLoading } = useSession();
  const storageKey = useMemo(
    () => getAiApiKeyStorageKey(session),
    [session],
  );
  const baseUrlStorageKey = useMemo(
    () => getOpenAiCompatibleBaseUrlStorageKey(session),
    [session],
  );
  const [[isKeyLoading, storedAiApiKey], setAiApiKey] =
    useStorageState(storageKey);
  const [[isBaseUrlLoading, storedBaseUrl], setStoredBaseUrl] =
    useStorageState(baseUrlStorageKey);

  const [input, setInput] = useState(storedAiApiKey ?? "");
  const [baseUrlInput, setBaseUrlInput] = useState(
    storedBaseUrl ?? DEFAULT_OPENAI_COMPAT_BASE_URL,
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInput(storedAiApiKey ?? "");
  }, [storedAiApiKey, storageKey]);

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
    if (storedAiApiKey) return;

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
          setAiApiKey(next);
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
    storedAiApiKey,
    setAiApiKey,
  ]);

  const saveAiApiKey = () => {
    if (isSessionLoading || !session) {
      setMessage("Please sign in before saving your API key.");
      return;
    }
    if (!input.trim()) {
      setMessage("Please enter a valid API key.");
      return;
    }
    setAiApiKey(input.trim());
    setMessage("API key saved securely for your account.");
  };

  const clearAiApiKey = async () => {
    // Remove global slot first so the migration effect cannot repopulate the field.
    await clearGlobalApiKeyStorage();
    setAiApiKey(null);
    setInput("");
    setMessage("API key cleared for your account.");
  };

  const saveBaseUrl = () => {
    if (isSessionLoading || !session) {
      setMessage("Please sign in before saving the base URL.");
      return;
    }
    try {
      const normalized = normalizeOpenAiCompatibleBaseUrl(baseUrlInput);
      const coerced = coerceOpenAiCompatibleBaseUrl(normalized);
      if (coerced === DEFAULT_OPENAI_COMPAT_BASE_URL) {
        setStoredBaseUrl(null);
        setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
        setMessage("Using the app’s default base URL.");
        return;
      }
      setStoredBaseUrl(coerced);
      setBaseUrlInput(coerced);
      setMessage("Base URL saved.");
    } catch {
      setMessage("Enter a valid URL (https://…), e.g. your provider’s API root.");
    }
  };

  const resetBaseUrlToDefault = () => {
    setStoredBaseUrl(null);
    setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
    setMessage("Reset to the app’s default base URL.");
  };

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
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
          contentInsetAdjustmentBehavior={
            Platform.OS === "ios" ? "automatic" : undefined
          }
        >
          <AppText muted>
            {isKeyLoading || isBaseUrlLoading
              ? "Loading settings..."
              : "API key and base URL are stored locally using secure storage on native. If no key is saved here, a default key from your app’s build configuration may be used (see project docs)."}
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
            If you only enter a host, the app appends the usual API path where
            possible (often /v1; some gateways use /api/v1). Pick the model in
            Chat. Wrong base URLs often return “not found” (404).
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
            onSubmitEditing={saveAiApiKey}
          />
          {!isKeyLoading &&
          !storedAiApiKey?.trim() &&
          hasEnvDefaultAiApiKey() ? (
            <AppText muted style={styles.hint}>
              No key saved for this account. Chat may use a default key from
              your build until you save one here.
            </AppText>
          ) : null}

          <View style={styles.buttonRow}>
            <AppButton
              label="Save API key"
              onPress={saveAiApiKey}
              style={styles.rowButton}
            />
            <AppButton
              label="Clear API key"
              variant="secondary"
              onPress={clearAiApiKey}
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
