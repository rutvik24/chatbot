import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";

import { AppText } from "@/components/common";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";

export type TabScreenHeaderProps = {
  /** Shown centered (e.g. Chat, Settings). */
  title: string;
  onMenuPress: () => void;
};

/**
 * Top bar for native tab roots: screen title + drawer menu control.
 */
export function TabScreenHeader({ title, onMenuPress }: TabScreenHeaderProps) {
  useColorScheme();
  const colors = useNativeThemeColors();

  return (
    <View
      style={[
        styles.bar,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Pressable
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={12}
        style={styles.sideSlot}
      >
        <SymbolView
          name={{
            ios: "line.3.horizontal",
            android: "menu",
            web: "menu",
          }}
          size={22}
          tintColor={colors.text}
        />
      </Pressable>
      <AppText
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      <View style={styles.sideSlot} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideSlot: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});
