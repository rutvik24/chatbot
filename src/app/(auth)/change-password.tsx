import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppButton,
  AppText,
  AppTextInput,
  PasswordChecklist,
  AuthIllustration,
} from "@/components/common";
import { useSession } from "@/ctx/auth-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { isStrongPassword } from "@/utils/password-validation";
import { showToast } from "@/utils/toast-bus";

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ChangePasswordScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { changePassword } = useSession();
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [form, setForm] = useState<FormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = () => {
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (!isStrongPassword(form.newPassword)) {
      setError(
        "Use at least 8 chars, including uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const result = changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });

    if (!result.ok) {
      if (result.code === "INVALID_CURRENT_PASSWORD") {
        setError("Current password is incorrect.");
      } else {
        setError("Unable to update password for this account.");
      }
      return;
    }

    setSuccess("Password changed successfully.");
    showToast("Password changed successfully");
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 8}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AppText style={styles.title}>Change password</AppText>
            <AppText muted>
              This screen is protected and only visible when you are logged in.
            </AppText>
            <AuthIllustration variant="changePassword" />

            <AppTextInput
              label="Current password"
              value={form.currentPassword}
              onChangeText={(currentPassword: string) =>
                setForm((previous) => ({ ...previous, currentPassword }))
              }
              isPasswordField
              placeholder="Current password"
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
              placeholder="New password"
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
              placeholder="Confirm new password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {error ? (
              <AppText style={[styles.message, { color: colors.error }]}>
                {error}
              </AppText>
            ) : null}
            {success ? (
              <AppText style={[styles.message, { color: colors.primary }]}>
                {success}
              </AppText>
            ) : null}

            <AppButton label="Update password" onPress={handleSubmit} />
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
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  message: {
    fontSize: 13,
    fontWeight: "600",
  },
});

