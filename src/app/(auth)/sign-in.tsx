import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, AppTextInput, AuthIllustration } from '@/components/common';
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

export default function SignInScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});

  const canSubmit = useMemo(
    () => form.email.trim().length > 0 && form.password.length > 0,
    [form.email, form.password]
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
      showToast('Signed in successfully');
      router.replace('/');
      return;
    }

    if (result.code === 'USER_NOT_FOUND') {
      setErrors({ general: 'User not found.' });
      return;
    }

    setErrors({ general: 'Incorrect password. Please try again.' });
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : undefined
        }
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText muted style={styles.subtitle}>Sign in to continue to your account.</AppText>
          <AuthIllustration variant="signIn" />

          <AppTextInput
            label="Email"
            value={form.email}
            onChangeText={(email: string) => setForm((previous) => ({ ...previous, email }))}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            placeholder="your-email@example.com"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <AppTextInput
            ref={passwordRef}
            label="Password"
            value={form.password}
            onChangeText={(password: string) => setForm((previous) => ({ ...previous, password }))}
            isPasswordField
            error={errors.password}
            placeholder="Password123!"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {errors.general ? <AppText style={[styles.generalError, { color: colors.error }]}>{errors.general}</AppText> : null}

          <AppButton label="Sign In" onPress={handleSubmit} disabled={!canSubmit} />

          <View style={styles.linksRow}>
            <Pressable onPress={() => router.push('/sign-up')}>
              <AppText style={styles.linkText}>Create account</AppText>
            </Pressable>
            <Pressable onPress={() => router.push('/forgot-password')}>
              <AppText style={styles.linkText}>Forgot password</AppText>
            </Pressable>
          </View>

        </View>
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
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  subtitle: {
    marginBottom: 8,
  },
  generalError: {
    fontSize: 13,
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
