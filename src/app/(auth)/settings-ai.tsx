import * as SecureStore from 'expo-secure-store';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, AppTextInput } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { useStorageState } from '@/hooks/use-storage-state';
import {
  DEFAULT_OPENAI_COMPAT_BASE_URL,
  coerceOpenAiCompatibleBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from '@/services/openai-compatible-chat';
import { hasEnvDefaultAiApiKey } from '@/utils/ai-api-key-env';
import {
  GLOBAL_API_KEY_STORAGE_KEY,
  clearGlobalApiKeyStorage,
  getAiApiKeyStorageKey,
  getOpenAiCompatibleBaseUrlStorageKey,
} from '@/utils/ai-credentials-storage';

function cardShadow() {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
    },
    android: { elevation: 2 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
  });
}

function InfoCallout({
  children,
  colors,
  icon,
}: {
  children: ReactNode;
  colors: ReturnType<typeof useNativeThemeColors>;
  icon: 'info' | 'lock' | 'link';
}) {
  const iconName =
    icon === 'lock'
      ? ({ ios: 'lock.shield.fill', android: 'shield', web: 'shield' } as const)
      : icon === 'link'
        ? ({
            ios: 'link.circle.fill',
            android: 'link',
            web: 'link',
          } as const)
        : ({
            ios: 'info.circle.fill',
            android: 'info',
            web: 'info',
          } as const);

  return (
    <View
      style={[
        styles.callout,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <SymbolView name={iconName} size={20} tintColor={colors.primary} />
      <AppText muted style={styles.calloutText}>
        {children}
      </AppText>
    </View>
  );
}

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

  const [input, setInput] = useState(storedAiApiKey ?? '');
  const [baseUrlInput, setBaseUrlInput] = useState(
    storedBaseUrl ?? DEFAULT_OPENAI_COMPAT_BASE_URL,
  );
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );

  useEffect(() => {
    setInput(storedAiApiKey ?? '');
  }, [storedAiApiKey, storageKey]);

  useEffect(() => {
    setBaseUrlInput(storedBaseUrl ?? DEFAULT_OPENAI_COMPAT_BASE_URL);
  }, [storedBaseUrl, baseUrlStorageKey]);

  useEffect(() => {
    if (isKeyLoading) return;
    if (isSessionLoading) return;
    if (!session) return;
    if (storageKey === GLOBAL_API_KEY_STORAGE_KEY) return;
    if (storedAiApiKey) return;

    let cancelled = false;
    (async () => {
      try {
        const next =
          Platform.OS === 'web'
            ? typeof localStorage !== 'undefined'
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

  const showSuccess = (text: string) => {
    setMessageTone('success');
    setMessage(text);
  };

  const showError = (text: string) => {
    setMessageTone('error');
    setMessage(text);
  };

  const saveAiApiKey = () => {
    if (isSessionLoading || !session) {
      showError('Sign in first, then save your API key.');
      return;
    }
    if (!input.trim()) {
      showError('Paste a valid API key from your provider.');
      return;
    }
    setAiApiKey(input.trim());
    showSuccess('Saved securely on this device for your account.');
  };

  const clearAiApiKey = async () => {
    await clearGlobalApiKeyStorage();
    setAiApiKey(null);
    setInput('');
    showSuccess('API key removed. Chat may use a build default if one exists.');
  };

  const saveBaseUrl = () => {
    if (isSessionLoading || !session) {
      showError('Sign in before changing the base URL.');
      return;
    }
    try {
      const normalized = normalizeOpenAiCompatibleBaseUrl(baseUrlInput);
      const coerced = coerceOpenAiCompatibleBaseUrl(normalized);
      if (coerced === DEFAULT_OPENAI_COMPAT_BASE_URL) {
        setStoredBaseUrl(null);
        setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
        showSuccess('Using the app’s default API URL.');
        return;
      }
      setStoredBaseUrl(coerced);
      setBaseUrlInput(coerced);
      showSuccess('Base URL saved. Pick a model in Chat if the list refreshes.');
    } catch {
      showError(
        'Use a full URL (https://…), e.g. your provider’s OpenAI-compatible root.',
      );
    }
  };

  const resetBaseUrlToDefault = () => {
    setStoredBaseUrl(null);
    setBaseUrlInput(DEFAULT_OPENAI_COMPAT_BASE_URL);
    showSuccess('Reset to the default base URL.');
  };

  const isLoading = isKeyLoading || isBaseUrlLoading;

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'automatic' : undefined
          }
        >
          {/* Hero */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...cardShadow(),
              },
            ]}
          >
            <View
              style={[
                styles.heroIconWrap,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <SymbolView
                name={{
                  ios: 'sparkles',
                  android: 'auto_awesome',
                  web: 'auto_awesome',
                }}
                size={28}
                tintColor={colors.primary}
              />
            </View>
            <View style={styles.heroText}>
              <AppText style={[styles.heroTitle, { color: colors.text }]}>
                AI connection
              </AppText>
              <AppText muted style={styles.heroSubtitle}>
                Connect any OpenAI-compatible API. Keys stay on this device.
              </AppText>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <AppText muted style={styles.loadingLabel}>
                Loading saved settings…
              </AppText>
            </View>
          ) : null}

          {/* Base URL */}
          <View style={styles.section}>
            <AppText
              style={[styles.sectionTitle, { color: colors.text }]}
              accessibilityRole="header"
            >
              Provider URL
            </AppText>
            <AppText muted style={styles.sectionSubtitle}>
              Where requests are sent (OpenAI, OpenRouter, local gateway, etc.).
            </AppText>
          </View>

          <InfoCallout colors={colors} icon="link">
            If you paste only a hostname, the app adds common paths like /v1.
            Wrong URLs often return 404—double-check your provider’s docs.
          </InfoCallout>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...cardShadow(),
              },
            ]}
          >
            <AppTextInput
              label="Base URL"
              value={baseUrlInput}
              onChangeText={setBaseUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={DEFAULT_OPENAI_COMPAT_BASE_URL}
              returnKeyType="done"
              onSubmitEditing={saveBaseUrl}
            />
            <View style={styles.cardButtonCol}>
              <AppButton
                label="Save URL"
                onPress={saveBaseUrl}
                style={styles.cardButton}
              />
              <AppButton
                label="Use default URL"
                variant="secondary"
                onPress={resetBaseUrlToDefault}
                style={styles.cardButton}
              />
            </View>
          </View>

          {/* API key */}
          <View style={styles.section}>
            <AppText
              style={[styles.sectionTitle, { color: colors.text }]}
              accessibilityRole="header"
            >
              API key
            </AppText>
            <AppText muted style={styles.sectionSubtitle}>
              Your secret is stored in secure storage (native) or browser storage
              (web)—never sent except to the URL above when you chat.
            </AppText>
          </View>

          <InfoCallout colors={colors} icon="lock">
            Never share your key or commit it to git. Revoke it from your
            provider if it leaks.
          </InfoCallout>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...cardShadow(),
              },
            ]}
          >
            <AppTextInput
              label="Secret key"
              value={input}
              onChangeText={setInput}
              isPasswordField
              placeholder="sk-… or provider token"
              returnKeyType="done"
              onSubmitEditing={saveAiApiKey}
            />
            {!isKeyLoading &&
            !storedAiApiKey?.trim() &&
            hasEnvDefaultAiApiKey() ? (
              <View
                style={[
                  styles.envHint,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: 'key.horizontal.fill',
                    android: 'vpn_key',
                    web: 'vpn_key',
                  }}
                  size={18}
                  tintColor={colors.secondaryText}
                />
                <AppText muted style={styles.envHintText}>
                  No key saved yet—Chat may use a default from your app build
                  until you save one here.
                </AppText>
              </View>
            ) : null}
            <View style={styles.cardButtonCol}>
              <AppButton
                label="Save API key"
                onPress={saveAiApiKey}
                style={styles.cardButton}
              />
              <Pressable
                onPress={clearAiApiKey}
                accessibilityRole="button"
                accessibilityLabel="Clear saved API key"
                style={({ pressed }) => [
                  styles.clearKeyButton,
                  {
                    borderColor: colors.error,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: 'trash',
                    android: 'delete',
                    web: 'delete',
                  }}
                  size={18}
                  tintColor={colors.error}
                />
                <AppText style={[styles.clearKeyLabel, { color: colors.error }]}>
                  Clear saved key
                </AppText>
              </Pressable>
            </View>
          </View>

          {message ? (
            <View
              style={[
                styles.feedbackBanner,
                {
                  borderColor:
                    messageTone === 'success' ? colors.success : colors.error,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <SymbolView
                name={
                  messageTone === 'success'
                    ? {
                        ios: 'checkmark.circle.fill',
                        android: 'check_circle',
                        web: 'check_circle',
                      }
                    : {
                        ios: 'exclamationmark.circle.fill',
                        android: 'error',
                        web: 'error',
                      }
                }
                size={22}
                tintColor={
                  messageTone === 'success' ? colors.success : colors.error
                }
              />
              <AppText style={[styles.feedbackText, { color: colors.text }]}>
                {message}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 16,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: 6,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calloutText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  cardButtonCol: {
    gap: 10,
  },
  cardButton: {
    minHeight: 50,
    borderRadius: 14,
  },
  envHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  envHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  clearKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  clearKeyLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
