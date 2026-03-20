import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
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

import {
  AUTH_PRIMARY_BUTTON_STYLE,
  authScrollContentStyle,
  AuthFeedbackBanner,
  AuthFormCard,
  AuthHero,
  AuthTextButton,
} from '@/components/auth';
import {
  AppButton,
  AppText,
  AppTextInput,
  AuthIllustration,
  PasswordChecklist,
} from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { isStrongPassword } from '@/utils/password-validation';
import { showToast } from '@/utils/toast-bus';

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

const HERO_ICON = {
  ios: 'person.crop.circle.badge.plus' as const,
  android: 'person_add' as const,
  web: 'person_add' as const,
};

export default function SignUpScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signUp } = useSession();
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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

  const handleSubmit = async () => {
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
        'Use at least 8 characters with upper, lower, number, and a symbol.';
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!form.acceptedTerms) {
      nextErrors.acceptedTerms =
        'Please accept the terms to create your account.';
    }

    setErrors(nextErrors);
    setSuccessMessage('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const result = await signUp({
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
    });

    if (!result.ok) {
      setErrors({
        general:
          'That email is already registered. Sign in instead or use another email.',
      });
      return;
    }

    const firstName = form.firstName.trim();
    setSuccessMessage('Account created. Taking you to the app…');
    showToast(firstName ? `Welcome, ${firstName}!` : 'Account created');
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    });

    router.replace('/');
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
          contentContainerStyle={[authScrollContentStyle, styles.signUpScroll]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'automatic' : undefined
          }
        >
          <AuthFormCard>
            <AuthHero
              title="Create your account"
              subtitle="One minute to get started. Your data stays on this device in this demo app."
              icon={HERO_ICON}
            />
            <AuthIllustration variant="signUp" />

            <View style={styles.nameRow}>
              <View style={styles.nameInput}>
                <AppTextInput
                  label="First name"
                  value={form.firstName}
                  onChangeText={(firstName: string) =>
                    setForm((previous) => ({ ...previous, firstName }))
                  }
                  error={errors.firstName}
                  placeholder="John"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={styles.nameInput}>
                <AppTextInput
                  ref={lastNameRef}
                  label="Last name"
                  value={form.lastName}
                  onChangeText={(lastName: string) =>
                    setForm((previous) => ({ ...previous, lastName }))
                  }
                  error={errors.lastName}
                  placeholder="Doe"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <AppTextInput
              ref={emailRef}
              label="Email"
              value={form.email}
              onChangeText={(email: string) =>
                setForm((previous) => ({ ...previous, email }))
              }
              autoCapitalize="none"
              keyboardType="email-address"
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
              placeholder="Strong password"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
            <PasswordChecklist password={form.password} />
            <AppTextInput
              ref={confirmPasswordRef}
              label="Confirm password"
              value={form.confirmPassword}
              onChangeText={(confirmPassword: string) =>
                setForm((previous) => ({ ...previous, confirmPassword }))
              }
              isPasswordField
              error={errors.confirmPassword}
              placeholder="Repeat password"
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleSubmit();
              }}
            />

            <View
              style={[
                styles.termsCard,
                { borderColor: colors.border, backgroundColor: colors.background },
              ]}
            >
              <Pressable
                style={styles.termsRow}
                onPress={() =>
                  setForm((previous) => ({
                    ...previous,
                    acceptedTerms: !previous.acceptedTerms,
                  }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.acceptedTerms }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: form.acceptedTerms
                        ? colors.primary
                        : colors.border,
                      backgroundColor: form.acceptedTerms
                        ? colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  {form.acceptedTerms ? (
                    <SymbolView
                      name={{
                        ios: 'checkmark',
                        android: 'check',
                        web: 'check',
                      }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                  ) : null}
                </View>
                <AppText style={[styles.termsText, { color: colors.text }]}>
                  I agree to the Terms & Conditions and Privacy Policy (demo).
                </AppText>
              </Pressable>
            </View>
            {errors.acceptedTerms ? (
              <AppText style={[styles.inlineError, { color: colors.error }]}>
                {errors.acceptedTerms}
              </AppText>
            ) : null}

            {errors.general ? (
              <AuthFeedbackBanner tone="error" message={errors.general} />
            ) : null}
            {successMessage ? (
              <AuthFeedbackBanner tone="success" message={successMessage} />
            ) : null}

            <AppButton
              label="Create account"
              onPress={handleSubmit}
              style={AUTH_PRIMARY_BUTTON_STYLE}
            />

            <View style={styles.footerCenter}>
              <AuthTextButton
                label="Already have an account? Sign in"
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
  signUpScroll: {
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
  },
  termsCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 8,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  inlineError: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerCenter: {
    alignItems: 'center',
    marginTop: 4,
  },
});
