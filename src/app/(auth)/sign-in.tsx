import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AUTH_PRIMARY_BUTTON_STYLE,
  authScrollContentStyle,
  AuthFeedbackBanner,
  AuthFormCard,
  AuthHero,
  AuthLinksRow,
} from '@/components/auth';
import { AppButton, AppTextInput, AuthIllustration } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { showToast } from '@/utils/toast-bus';

type FormState = {
  email: string;
  password: string;
};

type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}

const HERO_ICON = {
  ios: 'bubble.left.and.bubble.right.fill' as const,
  android: 'chat' as const,
  web: 'chat' as const,
};

export default function SignInScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});

  const canSubmit = useMemo(
    () => form.email.trim().length > 0 && form.password.length > 0,
    [form.email, form.password],
  );

  const handleSubmit = () => {
    const validationErrors = validate(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const result = signIn({
      email: form.email,
      password: form.password,
    });

    if (result.ok) {
      showToast({
        title: 'Signed in',
        message: 'Good to see you again.',
      });
      router.replace('/');
      return;
    }

    if (result.code === 'USER_NOT_FOUND') {
      setErrors({ general: 'No account found for that email. Create one first?' });
      return;
    }

    setErrors({ general: 'That password doesn’t match. Try again or reset it.' });
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
              title="Welcome back"
              subtitle="Sign in to pick up your chats and settings on this device."
              icon={HERO_ICON}
            />
            <AuthIllustration variant="signIn" />

            <AppTextInput
              label="Email"
              value={form.email}
              onChangeText={(email: string) =>
                setForm((previous) => ({ ...previous, email }))
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              placeholder="you@example.com"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <AppTextInput
              ref={passwordRef}
              label="Password"
              value={form.password}
              onChangeText={(password: string) =>
                setForm((previous) => ({ ...previous, password }))
              }
              isPasswordField
              error={errors.password}
              placeholder="Your password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {errors.general ? (
              <AuthFeedbackBanner tone="error" message={errors.general} />
            ) : null}

            <AppButton
              label="Sign in"
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={AUTH_PRIMARY_BUTTON_STYLE}
            />

            <AuthLinksRow
              links={[
                { label: 'Create account', onPress: () => router.push('/sign-up') },
                {
                  label: 'Forgot password?',
                  onPress: () => router.push('/forgot-password'),
                },
              ]}
            />
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
});
