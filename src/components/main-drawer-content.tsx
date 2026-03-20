import { SymbolView } from "expo-symbols";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import { useChatActions } from "@/ctx/chat-actions-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";

type DrawerLikeNavigation = {
  closeDrawer: () => void;
  navigate: (name: string, params?: { screen?: string }) => void;
};

type MainDrawerContentProps = {
  navigation: DrawerLikeNavigation;
};

/**
 * Drawer menu for the logged-in shell (e.g. start a fresh in-memory chat).
 */
export default function MainDrawerContent({
  navigation,
}: MainDrawerContentProps) {
  useColorScheme();
  const insets = useSafeAreaInsets();
  const colors = useNativeThemeColors();
  const { startNewChat } = useChatActions();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <AppText style={[styles.appTitle, { color: colors.text }]}>
          Chat
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New chat"
        onPress={() => {
          startNewChat();
          navigation.navigate("(tabs)", { screen: "index" });
          navigation.closeDrawer();
        }}
        style={({ pressed }) => [
          styles.menuRow,
          {
            backgroundColor: pressed ? colors.surface : "transparent",
          },
        ]}
      >
        <SymbolView
          name={{
            ios: "square.and.pencil",
            android: "edit",
            web: "edit",
          }}
          size={22}
          tintColor={colors.primary}
        />
        <AppText style={[styles.menuLabel, { color: colors.text }]}>
          New chat
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  menuLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
