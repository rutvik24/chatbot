import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, AppTextInput, AuthIllustration } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { forgotPassword } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = () => {
    const normalized = email.trim();
    setError('');
    setSuccess('');

    if (!normalized) {
      setError('Email is required.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalized)) {
      setError('Please enter a valid email.');
      return;
    }

    const result = forgotPassword(normalized);

    if (!result.ok) {
      if (result.code === 'USER_NOT_FOUND') {
        setError('No account found for this email.');
      } else {
        setError('This account is locked. Password reset is disabled.');
      }
      return;
    }

    setSuccess('Reset link sent (mock). Check your inbox in a real backend integration.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText style={styles.title}>Forgot password</AppText>
        <AppText muted>Enter your email to request a password reset.</AppText>
        <AuthIllustration variant="forgotPassword" />

        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="test@expo.dev"
          error={error}
        />

        {success ? <AppText style={[styles.message, { color: colors.primary }]}>{success}</AppText> : null}

        <AppButton label="Send reset link" onPress={handleSubmit} />

        <Pressable onPress={() => router.push('/sign-in')}>
          <AppText style={styles.linkText}>Back to sign in</AppText>
        </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
