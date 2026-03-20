import { SymbolView } from 'expo-symbols';
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
import { displayEmailFromSession } from '@/utils/session-email';
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
  const localPart = email.split('@')[0] ?? '';
  const withCamelSplit = localPart.replace(/([a-z])([A-Z])/g, '$1 $2');
  const normalized = withCamelSplit.replace(/[^a-zA-Z0-9]+/g, ' ');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);

  const firstName = tokens[0] ? capitalize(tokens[0]) : '';
  const lastName = tokens[1] ? capitalize(tokens[1]) : '';
  return { firstName, lastName };
}

function cardShadow() {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
    },
    android: { elevation: 2 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
  });
}

export default function SettingsProfileScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { session } = useSession();
  const email = useMemo(() => displayEmailFromSession(session), [session]);
  const profileStorageKey = useMemo(
    () => getUserProfileStorageKey(session),
    [session],
  );

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
    const shouldPersist =
      !!defaults.firstName.trim() || !!defaults.lastName.trim();
    if (!shouldPersist) return;

    didAutoFillDefaultsRef.current = true;
    setProfile(defaults);
    setProfileValue(JSON.stringify(defaults));
  }, [email, isProfileLoading, profileValue, setProfileValue]);

  const saveProfile = () => {
    setProfileValue(JSON.stringify(profile));
    setMessage('Profile saved. The assistant will use this on your next message.');
  };

  const avatarLetter = (
    profile.firstName.trim().charAt(0) ||
    email.charAt(0) ||
    '?'
  ).toUpperCase();

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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'automatic' : undefined
          }
        >
          {/* Hero */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...cardShadow(),
              },
            ]}
          >
            <View
              style={[styles.avatar, { backgroundColor: colors.primary }]}
            >
              <AppText style={styles.avatarLetter}>{avatarLetter}</AppText>
            </View>
            <View style={styles.heroText}>
              <AppText style={[styles.heroTitle, { color: colors.text }]}>
                Your profile
              </AppText>
              <View style={styles.emailRow}>
                <SymbolView
                  name={{
                    ios: 'envelope.fill',
                    android: 'mail',
                    web: 'mail',
                  }}
                  size={14}
                  tintColor={colors.secondaryText}
                />
                <AppText
                  muted
                  numberOfLines={1}
                  style={styles.emailText}
                >
                  {email || 'Not signed in'}
                </AppText>
              </View>
            </View>
          </View>

          {/* Why this matters */}
          <View style={styles.section}>
            <AppText
              style={[styles.sectionTitle, { color: colors.text }]}
              accessibilityRole="header"
            >
              Personalization
            </AppText>
            <AppText muted style={styles.sectionSubtitle}>
              Your name helps the assistant greet you naturally. Nothing is sent
              to a server—everything stays on this device.
            </AppText>
          </View>

          {/* Name fields */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...cardShadow(),
              },
            ]}
          >
            <View style={styles.nameRow}>
              <View style={styles.nameInput}>
                <AppTextInput
                  label="First name"
                  value={profile.firstName}
                  onChangeText={(firstName: string) =>
                    setProfile((prev) => ({ ...prev, firstName }))
                  }
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
                  onChangeText={(lastName: string) =>
                    setProfile((prev) => ({ ...prev, lastName }))
                  }
                  placeholder="Doe"
                  returnKeyType="done"
                  onSubmitEditing={saveProfile}
                />
              </View>
            </View>
          </View>

          <AppButton
            label="Save profile"
            onPress={saveProfile}
            style={styles.saveButton}
            accessibilityLabel="Save profile to this device"
          />

          {message ? (
            <View
              style={[
                styles.successBanner,
                {
                  borderColor: colors.success,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: colors.success,
                    opacity: 0.1,
                    borderRadius: 15,
                  },
                ]}
              />
              <SymbolView
                name={{
                  ios: 'checkmark.circle.fill',
                  android: 'check_circle',
                  web: 'check_circle',
                }}
                size={22}
                tintColor={colors.success}
              />
              <AppText
                style={[styles.successText, { color: colors.text }]}
              >
                {message}
              </AppText>
            </View>
          ) : null}

          {isProfileLoading ? (
            <AppText muted style={styles.loadingHint}>
              Loading your saved profile…
            </AppText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 22,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 16,
  },
  successBanner: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  loadingHint: {
    textAlign: 'center',
    fontSize: 13,
  },
});
