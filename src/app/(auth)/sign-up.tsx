import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  AppText,
  AppTextInput,
  PasswordChecklist,
  AuthIllustration,
} from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { isStrongPassword } from '@/utils/password-validation';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

type FormErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptedTerms?: string;
  general?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signUp } = useSession();

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'First name is required.';
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = 'Last name is required.';
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email.';
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (!isStrongPassword(form.password)) {
      nextErrors.password =
        'Use at least 8 chars, including uppercase, lowercase, number, and special character.';
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!form.acceptedTerms) {
      nextErrors.acceptedTerms = 'Please accept Terms & Conditions and Privacy Policy.';
    }

    setErrors(nextErrors);
    setSuccessMessage('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const result = signUp({ email: form.email, password: form.password });

    if (!result.ok) {
      if (result.code === 'EMAIL_IN_USE') {
        setErrors({ general: 'Email is already registered. Try signing in instead.' });
        return;
      }

      setErrors({ general: 'This account is locked and cannot sign up again.' });
      return;
    }

    setSuccessMessage('Account created. You can now sign in with these credentials.');
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText style={styles.title}>Create account</AppText>
          <AppText muted>Sign up with a new email to test registration flow.</AppText>
          <AuthIllustration variant="signUp" />

          <View style={styles.nameRow}>
            <View style={styles.nameInput}>
              <AppTextInput
                label="First name"
                value={form.firstName}
                onChangeText={(firstName: string) => setForm((previous) => ({ ...previous, firstName }))}
                error={errors.firstName}
                placeholder="John"
              />
            </View>
            <View style={styles.nameInput}>
              <AppTextInput
                label="Last name"
                value={form.lastName}
                onChangeText={(lastName: string) => setForm((previous) => ({ ...previous, lastName }))}
                error={errors.lastName}
                placeholder="Doe"
              />
            </View>
          </View>

          <AppTextInput
            label="Email"
            value={form.email}
            onChangeText={(email: string) => setForm((previous) => ({ ...previous, email }))}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
            placeholder="new-user@expo.dev"
          />
          <AppTextInput
            label="Password"
            value={form.password}
            onChangeText={(password: string) => setForm((previous) => ({ ...previous, password }))}
            isPasswordField
            error={errors.password}
            placeholder="Password123!"
          />
          <PasswordChecklist password={form.password} />
          <AppTextInput
            label="Confirm password"
            value={form.confirmPassword}
            onChangeText={(confirmPassword: string) =>
              setForm((previous) => ({ ...previous, confirmPassword }))
            }
            isPasswordField
            error={errors.confirmPassword}
            placeholder="Password123!"
          />

          <Pressable
            style={styles.termsRow}
            onPress={() =>
              setForm((previous) => ({ ...previous, acceptedTerms: !previous.acceptedTerms }))
            }>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: form.acceptedTerms ? colors.primary : colors.border,
                  backgroundColor: form.acceptedTerms ? colors.primary : 'transparent',
                },
              ]}
            />
            <AppText style={styles.termsText}>
              I accept the Terms & Conditions and Privacy Policy
            </AppText>
          </Pressable>
          {errors.acceptedTerms ? (
            <AppText style={[styles.message, { color: colors.error }]}>{errors.acceptedTerms}</AppText>
          ) : null}

          {errors.general ? <AppText style={[styles.message, { color: colors.error }]}>{errors.general}</AppText> : null}
          {successMessage ? <AppText style={[styles.message, { color: colors.primary }]}>{successMessage}</AppText> : null}

          <AppButton label="Sign Up" onPress={handleSubmit} />

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
  nameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nameInput: {
    flex: 1,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 4,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
});
