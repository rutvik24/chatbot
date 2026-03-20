import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AUTH_PRIMARY_BUTTON_STYLE,
  authScrollContentStyle,
  AuthFeedbackBanner,
  AuthFormCard,
  AuthHero,
  AuthTextButton,
} from '@/components/auth';
import { AppButton, AppTextInput, AuthIllustration } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { showToast } from '@/utils/toast-bus';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HERO_ICON = {
  ios: 'key.horizontal.fill' as const,
  android: 'vpn_key' as const,
  web: 'vpn_key' as const,
};

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
      setError('Enter the email you used to sign up.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalized)) {
      setError('That doesn’t look like a valid email.');
      return;
    }

    const result = forgotPassword(normalized);

    if (!result.ok) {
      setError('We couldn’t find an account with that email.');
      return;
    }

    setSuccess(
      'In a real app, we’d email you a reset link. This demo only confirms your account exists.',
    );
    showToast('Reset flow completed (demo)');
  };

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
          contentContainerStyle={authScrollContentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'automatic' : undefined
          }
        >
          <AuthFormCard>
            <AuthHero
              title="Forgot password?"
              subtitle="Enter your email and we’ll walk you through recovery. In this demo, no real email is sent."
              icon={HERO_ICON}
            />
            <AuthIllustration variant="forgotPassword" />

            <AppTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              error={error}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {success ? (
              <AuthFeedbackBanner tone="success" message={success} />
            ) : null}

            <AppButton
              label="Continue"
              onPress={handleSubmit}
              style={AUTH_PRIMARY_BUTTON_STYLE}
            />

            <View style={styles.footerCenter}>
              <AuthTextButton
                label="Back to sign in"
                onPress={() => router.push('/sign-in')}
              />
            </View>
          </AuthFormCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  footerCenter: {
    alignItems: 'center',
  },
});
