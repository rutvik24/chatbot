import { StyleSheet, View, useColorScheme } from 'react-native';

import { AppText } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export default function ExploreScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText style={styles.title}>Protected Explore</AppText>
        <AppText muted>
          This tab is also protected by Expo Router guard and is only available when authenticated.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});
