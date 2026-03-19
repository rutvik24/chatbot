import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { AppButton, AppText, AppTextInput } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { useStorageState } from '@/hooks/use-storage-state';
import { getOpenRouterApiKeyStorageKey } from '@/utils/openrouter-storage';

export default function SettingsOpenRouterScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session, isLoading: isSessionLoading } = useSession();
  const storageKey = useMemo(() => getOpenRouterApiKeyStorageKey(session), [session]);
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] = useStorageState(storageKey);

  const [input, setInput] = useState(storedOpenRouterKey ?? '');
  const [message, setMessage] = useState('');
  const [shouldTestBoundary, setShouldTestBoundary] = useState(false);

  useEffect(() => {
    setInput(storedOpenRouterKey ?? '');
  }, [storedOpenRouterKey, storageKey]);

  useEffect(() => {
    // Migrate old global key -> per-user key once.
    const OLD_KEY = 'openrouter-api-key';
    if (isKeyLoading) return;
    if (isSessionLoading) return;
    if (!session) return;
    if (storageKey === OLD_KEY) return;
    if (storedOpenRouterKey) return;

    let cancelled = false;
    (async () => {
      try {
        const next =
          Platform.OS === 'web'
            ? typeof localStorage !== 'undefined'
              ? localStorage.getItem(OLD_KEY)
              : null
            : await SecureStore.getItemAsync(OLD_KEY);

        if (!cancelled && next) {
          setOpenRouterKey(next);
        }
      } catch {
        // Ignore migration failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isKeyLoading, isSessionLoading, session, storageKey, storedOpenRouterKey, setOpenRouterKey]);

  if (shouldTestBoundary) {
    throw new Error('Test ErrorBoundary');
  }

  const saveOpenRouterKey = () => {
    if (isSessionLoading || !session) {
      setMessage('Please sign in before saving your API key.');
      return;
    }
    if (!input.trim()) {
      setMessage('Please enter a valid OpenRouter API key.');
      return;
    }
    setOpenRouterKey(input.trim());
    setMessage('OpenRouter API key saved securely for your account.');
  };

  const clearOpenRouterKey = () => {
    if (isSessionLoading || !session) {
      setMessage('Please sign in before clearing your API key.');
      return;
    }
    setOpenRouterKey(null);
    setInput('');
    setMessage('OpenRouter API key cleared for your account.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText style={styles.title}>OpenRouter API Key</AppText>
        <AppText muted>
          {isKeyLoading ? 'Loading key...' : 'Key is stored locally using secure storage on native.'}
        </AppText>

        <AppTextInput
          label="API key"
          value={input}
          onChangeText={setInput}
          isPasswordField
          placeholder="sk-or-v1-..."
          returnKeyType="done"
          onSubmitEditing={saveOpenRouterKey}
        />
        <AppButton label="Save API Key" onPress={saveOpenRouterKey} />
        <AppButton label="Clear API Key" onPress={clearOpenRouterKey} />
        <AppButton
          label="Test ErrorBoundary"
          onPress={() => setShouldTestBoundary(true)}
          style={{ marginTop: 4 }}
        />
        {message ? <AppText style={[styles.message, { color: colors.primary }]}>{message}</AppText> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  message: { fontSize: 13, fontWeight: '600' },
});
