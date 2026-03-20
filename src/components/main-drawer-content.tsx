import { useDrawerStatus } from "@react-navigation/drawer";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import { useChatActions } from "@/ctx/chat-actions-context";
import { useChatHistory } from "@/ctx/chat-history-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import type { ChatHistorySummary } from "@/types/chat-history";

type DrawerLikeNavigation = {
  closeDrawer: () => void;
  navigate: (name: string, params?: { screen?: string }) => void;
};

type MainDrawerContentProps = {
  navigation: DrawerLikeNavigation;
};

function formatHistoryTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Drawer menu for the logged-in shell: new chat, encrypted local history, navigation.
 */
export default function MainDrawerContent({
  navigation,
}: MainDrawerContentProps) {
  useColorScheme();
  const insets = useSafeAreaInsets();
  const colors = useNativeThemeColors();
  const { startNewChat } = useChatActions();
  const drawerStatus = useDrawerStatus();
  const {
    summaries,
    isSummariesLoading,
    refreshSummaries,
    openHistorySession,
    deleteHistorySession,
  } = useChatHistory();

  useEffect(() => {
    if (drawerStatus === "open") {
      void refreshSummaries();
    }
  }, [drawerStatus, refreshSummaries]);

  const confirmDelete = useCallback(
    (item: ChatHistorySummary) => {
      Alert.alert(
        "Delete chat",
        `Remove “${item.title}” from this device? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void deleteHistorySession(item.id);
            },
          },
        ],
      );
    },
    [deleteHistorySession],
  );

  const onOpenHistory = useCallback(
    (id: string) => {
      void (async () => {
        await openHistorySession(id);
        navigation.navigate("(tabs)", { screen: "index" });
        navigation.closeDrawer();
      })();
    },
    [navigation, openHistorySession],
  );

  const renderHistoryItem = useCallback(
    ({ item }: { item: ChatHistorySummary }) => (
      <View
        style={[
          styles.historyRow,
          { borderBottomColor: colors.border ?? "rgba(128,128,128,0.2)" },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open chat: ${item.title}`}
          onPress={() => onOpenHistory(item.id)}
          style={({ pressed }) => [
            styles.historyMain,
            { backgroundColor: pressed ? colors.surface : "transparent" },
          ]}
        >
          <SymbolView
            name={{
              ios: "bubble.left.and.bubble.right",
              android: "chat_bubble",
              web: "chat_bubble",
            }}
            size={20}
            tintColor={colors.secondaryText}
          />
          <View style={styles.historyTextBlock}>
            <AppText
              style={[styles.historyTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.title}
            </AppText>
            <AppText
              style={[styles.historyMeta, { color: colors.secondaryText }]}
              numberOfLines={1}
            >
              {formatHistoryTimestamp(item.updatedAt)}
            </AppText>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete chat: ${item.title}`}
          hitSlop={12}
          onPress={() => confirmDelete(item)}
          style={({ pressed }) => [
            styles.historyDelete,
            { backgroundColor: pressed ? colors.surface : "transparent" },
          ]}
        >
          <SymbolView
            name={{
              ios: "trash",
              android: "delete",
              web: "delete",
            }}
            size={20}
            tintColor={colors.secondaryText}
          />
        </Pressable>
      </View>
    ),
    [colors, confirmDelete, onOpenHistory],
  );

  const listHeader = (
    <>
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

      <View style={styles.sectionHeader}>
        <AppText style={[styles.sectionTitle, { color: colors.text }]}>
          History
        </AppText>
        <AppText style={[styles.sectionHint, { color: colors.secondaryText }]}>
          Stored securely on this device
        </AppText>
      </View>

      {isSummariesLoading ? (
        <AppText style={[styles.loadingHint, { color: colors.secondaryText }]}>
          Loading…
        </AppText>
      ) : null}
    </>
  );

  return (
    <FlatList
      data={summaries}
      keyExtractor={(it) => it.id}
      renderItem={renderHistoryItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        !isSummariesLoading ? (
          <AppText
            style={[styles.emptyHint, { color: colors.secondaryText }]}
          >
            No saved chats yet. Conversations are saved automatically after you
            send a message.
          </AppText>
        ) : null
      }
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "500",
  },
  loadingHint: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 14,
  },
  emptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 12,
  },
  historyTextBlock: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  historyDelete: {
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
  },
});
