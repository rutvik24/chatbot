import { DrawerActions, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import MessageCopyPreferenceSwitch from "@/components/message-copy-preference-switch";
import { TabScreenHeader } from "@/components/tab-screen-header";
import type { ThemePreference } from "@/constants/theme-preference";
import { useSession } from "@/ctx/auth-context";
import { useThemePreference } from "@/ctx/theme-preference-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useStorageState } from "@/hooks/use-storage-state";
import type { ChatLaunchPreference } from "@/utils/chat-launch-preference";
import { getChatLaunchPreferenceStorageKey } from "@/utils/chat-launch-preference";
import {
  isMessageCopyEnabledFromStorage,
  MESSAGE_COPY_ENABLED_VALUE,
} from "@/utils/chat-message-copy-preference";
import { getMessageCopyEnabledStorageKey } from "@/utils/session-account-storage";
import { displayEmailFromSession } from "@/utils/session-email";

type SettingsLinkIcon = {
  ios: string;
  android: string;
  web: string;
};

type SettingsLink = {
  label: string;
  description: string;
  href: "/settings-profile" | "/settings-ai" | "/change-password";
  icon: SettingsLinkIcon;
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: { ios: string; android: string; web: string };
}[] = [
  {
    value: "system",
    label: "System",
    hint: "Match device",
    icon: {
      ios: "circle.lefthalf.filled",
      android: "brightness_auto",
      web: "brightness_auto",
    },
  },
  {
    value: "light",
    label: "Light",
    hint: "Always light",
    icon: { ios: "sun.max.fill", android: "light_mode", web: "light_mode" },
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Always dark",
    icon: { ios: "moon.stars.fill", android: "dark_mode", web: "dark_mode" },
  },
];

const CHAT_LAUNCH_OPTIONS: {
  value: ChatLaunchPreference;
  label: string;
  hint: string;
  icon: { ios: string; android: string; web: string };
}[] = [
  {
    value: "resume_recent",
    label: "Recent chat",
    hint: "Restore last conversation",
    icon: {
      ios: "clock.arrow.circlepath",
      android: "history",
      web: "history",
    },
  },
  {
    value: "start_fresh",
    label: "New chat",
    hint: "Empty composer on open",
    icon: {
      ios: "square.and.pencil",
      android: "edit_square",
      web: "edit_square",
    },
  },
];

function SettingsSection({
  title,
  subtitle,
  children,
  colors,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  colors: ReturnType<typeof useNativeThemeColors>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText muted style={styles.sectionSubtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SettingsCard({
  children,
  colors,
}: {
  children: ReactNode;
  colors: ReturnType<typeof useNativeThemeColors>;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 14,
            },
            android: { elevation: 2 },
            default: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
          }),
        },
      ]}
    >
      {children}
    </View>
  );
}

function SettingsLinkRow({
  item,
  colors,
  isLast,
  onPress,
}: {
  item: SettingsLink;
  colors: ReturnType<typeof useNativeThemeColors>;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}. ${item.description}`}
      style={({ pressed }) => [
        styles.linkRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? colors.background : "transparent",
        },
      ]}
    >
      <View
        style={[
          styles.linkIconWrap,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <SymbolView
          name={item.icon as ComponentProps<typeof SymbolView>["name"]}
          size={22}
          tintColor={colors.primary}
        />
      </View>
      <View style={styles.linkTextCol}>
        <AppText style={[styles.linkTitle, { color: colors.text }]}>
          {item.label}
        </AppText>
        <AppText muted style={styles.linkDescription}>
          {item.description}
        </AppText>
      </View>
      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={14}
        tintColor={colors.secondaryText}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  useColorScheme();
  const navigation = useNavigation();
  const colors = useNativeThemeColors();
  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);
  const { preference, setPreference } = useThemePreference();
  const { session, signOut } = useSession();
  const chatLaunchStorageKey = useMemo(
    () => getChatLaunchPreferenceStorageKey(session),
    [session],
  );
  const [[, storedChatLaunchPref], setChatLaunchPref] =
    useStorageState(chatLaunchStorageKey);
  const chatLaunchEffective: ChatLaunchPreference =
    storedChatLaunchPref === "start_fresh" ? "start_fresh" : "resume_recent";
  const messageCopyStorageKey = useMemo(
    () => getMessageCopyEnabledStorageKey(session),
    [session],
  );
  const [[, storedMessageCopyPref], setMessageCopyPref] =
    useStorageState(messageCopyStorageKey);
  const messageCopyEnabled = isMessageCopyEnabledFromStorage(
    storedMessageCopyPref,
  );
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);
  const [shouldTestBoundary, setShouldTestBoundary] = useState(false);

  const accountLinks: SettingsLink[] = useMemo(
    () => [
      {
        label: "Profile",
        description: "Name & details used to personalize replies",
        href: "/settings-profile",
        icon: {
          ios: "person.crop.circle.fill",
          android: "account_circle",
          web: "account_circle",
        },
      },
      {
        label: "AI settings",
        description: "API key, model, and provider connection",
        href: "/settings-ai",
        icon: {
          ios: "sparkles",
          android: "auto_awesome",
          web: "auto_awesome",
        },
      },
    ],
    [],
  );

  const securityLinks: SettingsLink[] = useMemo(
    () => [
      {
        label: "Change password",
        description: "Update your account password",
        href: "/change-password",
        icon: {
          ios: "key.fill",
          android: "vpn_key",
          web: "vpn_key",
        },
      },
    ],
    [],
  );

  const emailDisplay =
    displayEmailFromSession(session).trim() || "Your account";
  const avatarLetter = emailDisplay.charAt(0).toUpperCase();

  if (shouldTestBoundary) {
    throw new Error("Test ErrorBoundary");
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TabScreenHeader title="Settings" onMenuPress={openDrawer} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile hero */}
        <Pressable
          onPress={() => router.push("/settings-profile")}
          accessibilityRole="button"
          accessibilityLabel="Open profile settings"
          style={({ pressed }) => [
            styles.heroPressable,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <SettingsCard colors={colors}>
            <View style={styles.heroInner}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <AppText style={styles.avatarLetter}>{avatarLetter}</AppText>
              </View>
              <View style={styles.heroText}>
                <AppText
                  style={[styles.heroGreeting, { color: colors.secondaryText }]}
                >
                  Signed in as
                </AppText>
                <AppText
                  style={[styles.heroEmail, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {emailDisplay}
                </AppText>
                <View style={styles.heroHintRow}>
                  <AppText
                    muted
                    style={[styles.heroHint, { color: colors.primary }]}
                  >
                    Edit profile
                  </AppText>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    size={12}
                    tintColor={colors.primary}
                  />
                </View>
              </View>
            </View>
          </SettingsCard>
        </Pressable>

        {/* Appearance */}
        <SettingsSection
          title="Appearance"
          subtitle="Looks great in any light — pick what feels right."
          colors={colors}
        >
          <View style={styles.themeChipRow}>
            {THEME_OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label}. ${opt.hint}`}
                  onPress={() => setPreference(opt.value)}
                  style={({ pressed }) => {
                    const base = {
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.88 : 1,
                      overflow: "hidden" as const,
                    };
                    const iosShadow =
                      Platform.OS === "ios" && selected
                        ? {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 10,
                          }
                        : {};
                    const androidElev =
                      Platform.OS === "android"
                        ? { elevation: selected ? 2 : 0 }
                        : {};
                    return [styles.themeChip, base, iosShadow, androidElev];
                  }}
                >
                  {selected ? (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors.primary, opacity: 0.1 },
                      ]}
                    />
                  ) : null}
                  <SymbolView
                    name={opt.icon as ComponentProps<typeof SymbolView>["name"]}
                    size={24}
                    tintColor={selected ? colors.primary : colors.secondaryText}
                  />
                  <AppText
                    style={[
                      styles.themeChipLabel,
                      { color: selected ? colors.primary : colors.text },
                    ]}
                  >
                    {opt.label}
                  </AppText>
                  <AppText muted style={styles.themeChipHint} numberOfLines={1}>
                    {opt.hint}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </SettingsSection>

        {/* Chat launch */}
        <SettingsSection
          title="Chat"
          subtitle="When you sign in or open the app, choose what Chat shows first. Stored per account in SecureStore (iOS/Android) or browser storage (web)."
          colors={colors}
        >
          <View style={styles.themeChipRow}>
            {CHAT_LAUNCH_OPTIONS.map((opt) => {
              const selected = chatLaunchEffective === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label}. ${opt.hint}`}
                  onPress={() => setChatLaunchPref(opt.value)}
                  style={({ pressed }) => {
                    const base = {
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.88 : 1,
                      overflow: "hidden" as const,
                    };
                    const iosShadow =
                      Platform.OS === "ios" && selected
                        ? {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 10,
                          }
                        : {};
                    const androidElev =
                      Platform.OS === "android"
                        ? { elevation: selected ? 2 : 0 }
                        : {};
                    return [styles.themeChip, base, iosShadow, androidElev];
                  }}
                >
                  {selected ? (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors.primary, opacity: 0.1 },
                      ]}
                    />
                  ) : null}
                  <SymbolView
                    name={opt.icon as ComponentProps<typeof SymbolView>["name"]}
                    size={24}
                    tintColor={selected ? colors.primary : colors.secondaryText}
                  />
                  <AppText
                    style={[
                      styles.themeChipLabel,
                      { color: selected ? colors.primary : colors.text },
                    ]}
                  >
                    {opt.label}
                  </AppText>
                  <AppText muted style={styles.themeChipHint} numberOfLines={2}>
                    {opt.hint}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText muted style={styles.chatLaunchFootnote}>
            Applies the next time your session loads (e.g. after sign-in or
            restarting the app).
          </AppText>
          <SettingsCard colors={colors}>
            <View style={styles.messageCopySwitchRow}>
              <View style={styles.messageCopySwitchTextCol}>
                <AppText
                  style={[styles.messageCopySwitchTitle, { color: colors.text }]}
                >
                  Copy messages
                </AppText>
                <AppText muted style={styles.messageCopySwitchSubtitle}>
                  Show a copy button on each chat bubble (raw text / markdown).
                  Off by default.
                </AppText>
              </View>
              <MessageCopyPreferenceSwitch
                value={messageCopyEnabled}
                onValueChange={(on) =>
                  setMessageCopyPref(on ? MESSAGE_COPY_ENABLED_VALUE : null)
                }
                colors={{
                  primary: colors.primary,
                  border: colors.border,
                  secondaryText: colors.secondaryText,
                }}
              />
            </View>
          </SettingsCard>
        </SettingsSection>

        {/* Account */}
        <SettingsSection
          title="Account"
          subtitle="Your identity and how the assistant connects."
          colors={colors}
        >
          <SettingsCard colors={colors}>
            {accountLinks.map((item, index) => (
              <SettingsLinkRow
                key={item.href}
                item={item}
                colors={colors}
                isLast={index === accountLinks.length - 1}
                onPress={() => router.push(item.href)}
              />
            ))}
          </SettingsCard>
        </SettingsSection>

        {/* Security */}
        <SettingsSection
          title="Security"
          subtitle="Keep your account protected."
          colors={colors}
        >
          <SettingsCard colors={colors}>
            {securityLinks.map((item, index) => (
              <SettingsLinkRow
                key={item.href}
                item={item}
                colors={colors}
                isLast={index === securityLinks.length - 1}
                onPress={() => router.push(item.href)}
              />
            ))}
          </SettingsCard>
        </SettingsSection>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <Pressable
            onPress={() => setIsSignOutModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              {
                borderColor: colors.error,
                backgroundColor: "transparent",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <SymbolView
              name={{
                ios: "rectangle.portrait.and.arrow.right",
                android: "logout",
                web: "logout",
              }}
              size={20}
              tintColor={colors.error}
            />
            <AppText style={[styles.signOutLabel, { color: colors.error }]}>
              Sign out
            </AppText>
          </Pressable>
          <AppText muted style={styles.signOutCaption}>
            You’ll need to sign in again to use chat and saved preferences on
            this device.
          </AppText>
        </View>

        {__DEV__ ? (
          <Pressable
            onPress={() => {
              setShouldTestBoundary(true);
              setTimeout(() => setShouldTestBoundary(false), 0);
            }}
            style={styles.devRow}
            accessibilityRole="button"
            accessibilityLabel="Test error boundary (development only)"
          >
            <AppText muted style={styles.devText}>
              Developer: test ErrorBoundary
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={isSignOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSignOutModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          accessibilityLabel="Dismiss sign out dialog"
          onPress={() => setIsSignOutModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.modalIconCircle,
                {
                  borderColor: colors.error,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <SymbolView
                name={{
                  ios: "rectangle.portrait.and.arrow.right",
                  android: "logout",
                  web: "logout",
                }}
                size={28}
                tintColor={colors.error}
              />
            </View>
            <AppText style={[styles.modalTitle, { color: colors.text }]}>
              Sign out?
            </AppText>
            <AppText muted style={styles.modalBody}>
              You’ll be returned to the sign-in screen. Your API keys stay on
              this device until you remove them in AI settings.
            </AppText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsSignOutModalVisible(false)}
                style={({ pressed }) => [
                  styles.modalButtonSecondary,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.background
                      : colors.surface,
                  },
                ]}
              >
                <AppText style={{ color: colors.text, fontWeight: "600" }}>
                  Cancel
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsSignOutModalVisible(false);
                  signOut();
                }}
                style={({ pressed }) => [
                  styles.modalButtonPrimary,
                  {
                    backgroundColor: colors.error,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <AppText style={styles.modalButtonPrimaryText}>
                  Sign out
                </AppText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 28,
  },
  heroPressable: {
    borderRadius: 22,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  heroText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  heroEmail: {
    fontSize: 18,
    fontWeight: "700",
  },
  heroHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  heroHint: {
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  themeChipRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
  },
  themeChipLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  themeChipHint: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  chatLaunchFootnote: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  messageCopySwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  messageCopySwitchTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  messageCopySwitchTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  messageCopySwitchSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTextCol: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  linkDescription: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  signOutSection: {
    gap: 10,
    marginTop: 4,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 2,
  },
  signOutLabel: {
    fontSize: 17,
    fontWeight: "800",
  },
  signOutCaption: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  devRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  devText: {
    fontSize: 12,
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButtonSecondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});

