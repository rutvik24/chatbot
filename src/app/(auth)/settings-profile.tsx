import { useEffect, useMemo, useRef, useState } from 'react';
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

import { AppButton, AppText, AppTextInput } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { useStorageState } from '@/hooks/use-storage-state';
import {
  getUserProfileStorageKey,
  parseUserProfileFromStorage,
  type UserProfileFields,
} from '@/utils/user-profile-chat';

type Profile = UserProfileFields;

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function defaultNamesFromEmail(email: string): Profile {
  // Derive simple defaults from the email local-part (left of "@").
  // Example: "john.doe@example.com" => { firstName: "John", lastName: "Doe" }
  const localPart = email.split('@')[0] ?? '';
  // 1) Split camelCase (johnDoe -> john Doe)
  // 2) Replace any non-alphanumeric separator with spaces (john+doe, john-doe, john_doe, etc.)
  const withCamelSplit = localPart.replace(/([a-z])([A-Z])/g, '$1 $2');
  const normalized = withCamelSplit.replace(/[^a-zA-Z0-9]+/g, ' ');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);

  const firstName = tokens[0] ? capitalize(tokens[0]) : '';
  const lastName = tokens[1] ? capitalize(tokens[1]) : '';
  return { firstName, lastName };
}

export default function SettingsProfileScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session } = useSession();
  const email = useMemo(() => (session ? session.replace('session-', '') : ''), [session]);
  const profileStorageKey = useMemo(() => getUserProfileStorageKey(session), [session]);

  const [[isProfileLoading, profileValue], setProfileValue] =
    useStorageState(profileStorageKey);
  const [profile, setProfile] = useState<Profile>(() =>
    parseUserProfileFromStorage(profileValue),
  );
  const [message, setMessage] = useState('');
  const lastNameRef = useRef<TextInput>(null);
  const didAutoFillDefaultsRef = useRef(false);

  useEffect(() => {
    didAutoFillDefaultsRef.current = false;
  }, [email]);

  useEffect(() => {
    if (isProfileLoading) return;
    const parsed = parseUserProfileFromStorage(profileValue);
    const hasNames = !!parsed.firstName.trim() || !!parsed.lastName.trim();
    setProfile(parsed);

    if (hasNames) return;
    if (!email) return;
    if (didAutoFillDefaultsRef.current) return;

    const defaults = defaultNamesFromEmail(email);
    const shouldPersist = !!defaults.firstName.trim() || !!defaults.lastName.trim();
    if (!shouldPersist) return;

    didAutoFillDefaultsRef.current = true;
    setProfile(defaults);
    setProfileValue(JSON.stringify(defaults));
  }, [email, isProfileLoading, profileValue, setProfileValue]);

  const saveProfile = () => {
    setProfileValue(JSON.stringify(profile));
    setMessage('Profile saved locally.');
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : undefined
        }
      >
        <AppText muted numberOfLines={1}>
          Email: {email || 'Unknown'}
        </AppText>

        <View style={styles.nameRow}>
          <View style={styles.nameInput}>
            <AppTextInput
              label="First name"
              value={profile.firstName}
              onChangeText={(firstName: string) => setProfile((prev) => ({ ...prev, firstName }))}
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
              value={profile.lastName}
              onChangeText={(lastName: string) => setProfile((prev) => ({ ...prev, lastName }))}
              placeholder="Doe"
              returnKeyType="done"
              onSubmitEditing={saveProfile}
            />
          </View>
        </View>

        <AppButton label="Save Profile" onPress={saveProfile} />
        {message ? <AppText style={[styles.message, { color: colors.primary }]}>{message}</AppText> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  content: { padding: 16, gap: 12 },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: { flex: 1 },
  message: { fontSize: 13, fontWeight: '600' },
});
