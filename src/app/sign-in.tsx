import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, AppTextInput, AuthIllustration } from '@/components/common';
import { AuthTestUsers, useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

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
      router.replace('/');
      return;
    }

    if (result.code === 'USER_NOT_FOUND') {
      setErrors({ general: 'User not found. Try the valid test user credentials below.' });
      return;
    }

    if (result.code === 'USER_LOCKED') {
      setErrors({ general: 'This account is locked. Use a different test user.' });
      return;
    }

    setErrors({ general: 'Incorrect password. Please try again.' });
  };

  const fillValidCase = () => {
    setForm({ email: AuthTestUsers.valid.email, password: AuthTestUsers.valid.password });
    setErrors({});
  };

  const fillWrongPasswordCase = () => {
    setForm({ email: AuthTestUsers.valid.email, password: 'WrongPass123!' });
    setErrors({});
  };

  const fillUnknownUserCase = () => {
    setForm({ email: 'unknown@expo.dev', password: 'Password123!' });
    setErrors({});
  };

  const fillLockedUserCase = () => {
    setForm({ email: AuthTestUsers.locked.email, password: AuthTestUsers.locked.password });
    setErrors({});
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText style={styles.title}>Sign in</AppText>
        <AppText muted style={styles.subtitle}>
          Use the static test credentials or test the failure scenarios quickly.
        </AppText>
        <AuthIllustration variant="signIn" />

        <AppTextInput
          label="Email"
          value={form.email}
          onChangeText={(email: string) => setForm((previous) => ({ ...previous, email }))}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.email}
          placeholder="test@expo.dev"
        />

        <AppTextInput
          label="Password"
          value={form.password}
          onChangeText={(password: string) => setForm((previous) => ({ ...previous, password }))}
          isPasswordField
          error={errors.password}
          placeholder="Password123!"
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

        <View style={styles.testCases}>
          <AppText muted style={styles.testTitle}>
            Quick test cases
          </AppText>
          <Pressable onPress={fillValidCase}>
            <AppText style={styles.testCaseText}>Pass: Valid user + password</AppText>
          </Pressable>
          <Pressable onPress={fillWrongPasswordCase}>
            <AppText style={styles.testCaseText}>Error: Wrong password</AppText>
          </Pressable>
          <Pressable onPress={fillUnknownUserCase}>
            <AppText style={styles.testCaseText}>Error: Unknown user</AppText>
          </Pressable>
          <Pressable onPress={fillLockedUserCase}>
            <AppText style={styles.testCaseText}>Error: Locked account</AppText>
          </Pressable>
        </View>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginBottom: 8,
  },
  generalError: {
    fontSize: 13,
    fontWeight: '600',
  },
  testCases: {
    gap: 8,
    paddingTop: 8,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  testCaseText: {
    fontSize: 14,
    textDecorationLine: 'underline',
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
