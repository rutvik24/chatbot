import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";

import { AppText } from "@/components/common";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";

export type TabScreenHeaderProps = {
  /** Shown centered (e.g. Chat, Settings). */
  title: string;
  /** Optional one-line hint under the title (e.g. Chat only). */
  subtitle?: string;
  onMenuPress: () => void;
};

/**
 * Top bar for native tab roots: screen title + drawer menu control.
 */
export function TabScreenHeader({
  title,
  subtitle,
  onMenuPress,
}: TabScreenHeaderProps) {
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
      <View style={styles.titleCol}>
        <AppText
          style={[styles.title, { color: colors.text }]}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            muted
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.secondaryText }]}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
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
  titleCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
    marginTop: 2,
  },
});
