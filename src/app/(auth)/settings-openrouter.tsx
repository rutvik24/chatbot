import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, AppTextInput } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { useStorageState } from '@/hooks/use-storage-state';

export default function SettingsOpenRouterScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const [[isKeyLoading, storedOpenRouterKey], setOpenRouterKey] = useStorageState('openrouter-api-key');
  const [input, setInput] = useState(storedOpenRouterKey ?? '');
  const [message, setMessage] = useState('');

  const saveOpenRouterKey = () => {
    if (!input.trim()) {
      setMessage('Please enter a valid OpenRouter API key.');
      return;
    }
    setOpenRouterKey(input.trim());
    setMessage('OpenRouter API key saved securely on this device.');
  };

  const clearOpenRouterKey = () => {
    setOpenRouterKey(null);
    setInput('');
    setMessage('OpenRouter API key cleared.');
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
