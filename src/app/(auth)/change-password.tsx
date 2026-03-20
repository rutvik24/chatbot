import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const HERO_ICON = {
  ios: 'lock.rotation' as const,
  android: 'lock_reset' as const,
  web: 'lock_reset' as const,
};

export default function ChangePasswordScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { changePassword } = useSession();
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [form, setForm] = useState<FormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = () => {
    setError('');
    setSuccess('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('Fill in all three fields to continue.');
      return;
    }

    if (!isStrongPassword(form.newPassword)) {
      setError(
        'New password needs 8+ characters with upper, lower, number, and a symbol.',
      );
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation must match.');
      return;
    }

    const result = changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });

    if (!result.ok) {
      if (result.code === 'INVALID_CURRENT_PASSWORD') {
        setError('Current password is incorrect.');
      } else {
        setError('Couldn’t update your password. Try again.');
      }
      return;
    }

    setSuccess('Password updated.');
    showToast('Password changed successfully');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    router.back();
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
              title="Change password"
              subtitle="Use a strong new password you don’t reuse elsewhere. You’ll stay signed in after saving."
              icon={HERO_ICON}
            />
            <AuthIllustration variant="changePassword" />

            <View
              style={[
                styles.tipRow,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <SymbolView
                name={{
                  ios: 'lock.shield.fill',
                  android: 'shield',
                  web: 'shield',
                }}
                size={20}
                tintColor={colors.primary}
              />
              <AppText muted style={styles.tipText}>
                Only you can change this while signed in. We never see your
                password in plain text.
              </AppText>
            </View>

            <AppTextInput
              label="Current password"
              value={form.currentPassword}
              onChangeText={(currentPassword: string) =>
                setForm((previous) => ({ ...previous, currentPassword }))
              }
              isPasswordField
              placeholder="Enter current password"
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
            <AppTextInput
              ref={newPasswordRef}
              label="New password"
              value={form.newPassword}
              onChangeText={(newPassword: string) =>
                setForm((previous) => ({ ...previous, newPassword }))
              }
              isPasswordField
              placeholder="Create a strong password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
            <PasswordChecklist password={form.newPassword} />
            <AppTextInput
              ref={confirmPasswordRef}
              label="Confirm new password"
              value={form.confirmPassword}
              onChangeText={(confirmPassword: string) =>
                setForm((previous) => ({ ...previous, confirmPassword }))
              }
              isPasswordField
              placeholder="Repeat new password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {error ? (
              <AuthFeedbackBanner tone="error" message={error} />
            ) : null}
            {success ? (
              <AuthFeedbackBanner tone="success" message={success} />
            ) : null}

            <AppButton
              label="Update password"
              onPress={handleSubmit}
              style={AUTH_PRIMARY_BUTTON_STYLE}
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
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
