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

export default function SettingsProfileScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session } = useSession();
  const email = useMemo(() => (session ? session.replace('session-', '') : ''), [session]);
  const profileStorageKey = useMemo(() => getUserProfileStorageKey(session), [session]);

  const [[, profileValue], setProfileValue] = useStorageState(profileStorageKey);
  const [profile, setProfile] = useState<Profile>(() =>
    parseUserProfileFromStorage(profileValue),
  );
  const [message, setMessage] = useState('');
  const lastNameRef = useRef<TextInput>(null);

  useEffect(() => {
    setProfile(parseUserProfileFromStorage(profileValue));
  }, [profileValue]);

  const saveProfile = () => {
    setProfileValue(JSON.stringify(profile));
    setMessage('Profile saved locally.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText style={styles.title}>Profile</AppText>
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
  title: { fontSize: 26, fontWeight: '700' },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: { flex: 1 },
  message: { fontSize: 13, fontWeight: '600' },
});
