import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

/** Pass to `AppButton` `style` on auth screens for consistent CTAs. */
export const AUTH_PRIMARY_BUTTON_STYLE: ViewStyle = {
  minHeight: 54,
  borderRadius: 16,
};

function cardShadow() {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.09,
      shadowRadius: 26,
    },
    android: { elevation: 5 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
    },
  });
}

/** ScrollView `contentContainerStyle` for centered auth forms. */
export const authScrollContentStyle: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 40,
  alignItems: 'center',
  justifyContent: 'center',
  flexGrow: 1,
};

export function AuthFormCard({ children }: { children: ReactNode }) {
  const colors = useNativeThemeColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow(),
      ]}
    >
      {children}
    </View>
  );
}

export function AuthHero({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof SymbolView>['name'];
}) {
  const colors = useNativeThemeColors();
  return (
    <View style={styles.hero}>
      <View
        style={[
          styles.heroIconWrap,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <SymbolView name={icon} size={30} tintColor={colors.primary} />
      </View>
      <AppText
        style={[styles.heroTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      <AppText muted style={styles.heroSubtitle}>
        {subtitle}
      </AppText>
    </View>
  );
}

export function AuthFeedbackBanner({
  tone,
  message,
}: {
  tone: 'error' | 'success';
  message: string;
}) {
  const colors = useNativeThemeColors();
  const accent = tone === 'error' ? colors.error : colors.success;
  return (
    <View
      style={[
        styles.feedback,
        {
          borderColor: accent,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: accent,
            opacity: 0.1,
            borderRadius: 13,
          },
        ]}
      />
      <SymbolView
        name={
          tone === 'error'
            ? {
                ios: 'exclamationmark.circle.fill',
                android: 'error',
                web: 'error',
              }
            : {
                ios: 'checkmark.circle.fill',
                android: 'check_circle',
                web: 'check_circle',
              }
        }
        size={20}
        tintColor={accent}
      />
      <AppText style={[styles.feedbackText, { color: colors.text }]}>
        {message}
      </AppText>
    </View>
  );
}

export function AuthTextButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useNativeThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.textBtn,
        { opacity: pressed ? 0.72 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <AppText style={[styles.textBtnLabel, { color: colors.primary }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function AuthLinksRow({
  links,
}: {
  links: { label: string; onPress: () => void }[];
}) {
  const colors = useNativeThemeColors();
  return (
    <View style={styles.linksRow}>
      {links.map((link, index) => (
        <View key={link.label} style={styles.linkCluster}>
          {index > 0 ? (
            <View
              style={[styles.linkSep, { backgroundColor: colors.border }]}
            />
          ) : null}
          <AuthTextButton label={link.label} onPress={link.onPress} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  feedback: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  textBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  textBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  linkCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkSep: {
    width: StyleSheet.hairlineWidth * 2,
    height: 14,
    borderRadius: 1,
  },
});
