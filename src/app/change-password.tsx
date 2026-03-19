import { useState } from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
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
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ChangePasswordScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { changePassword } = useSession();
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
      setError('All fields are required.');
      return;
    }

    if (!isStrongPassword(form.newPassword)) {
      setError(
        'Use at least 8 chars, including uppercase, lowercase, number, and special character.'
      );
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
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
        setError('Unable to update password for this account.');
      }
      return;
    }

    setSuccess('Password changed successfully.');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText style={styles.title}>Change password</AppText>
          <AppText muted>This screen is protected and only visible when you are logged in.</AppText>
          <AuthIllustration variant="changePassword" />

          <AppTextInput
            label="Current password"
            value={form.currentPassword}
            onChangeText={(currentPassword: string) =>
              setForm((previous) => ({ ...previous, currentPassword }))
            }
            isPasswordField
          />
          <AppTextInput
            label="New password"
            value={form.newPassword}
            onChangeText={(newPassword: string) =>
              setForm((previous) => ({ ...previous, newPassword }))
            }
            isPasswordField
          />
          <PasswordChecklist password={form.newPassword} />
          <AppTextInput
            label="Confirm new password"
            value={form.confirmPassword}
            onChangeText={(confirmPassword: string) =>
              setForm((previous) => ({ ...previous, confirmPassword }))
            }
            isPasswordField
          />

          {error ? <AppText style={[styles.message, { color: colors.error }]}>{error}</AppText> : null}
          {success ? <AppText style={[styles.message, { color: colors.primary }]}>{success}</AppText> : null}

          <AppButton label="Update password" onPress={handleSubmit} />
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
});
