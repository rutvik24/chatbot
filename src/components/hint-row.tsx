import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';

/**
 * Props for {@link HintRow}.
 */
type HintRowProps = {
  /**
   * Optional title displayed on the left.
   *
   * Defaults to `Try editing`.
   */
  title?: string;
  /**
   * Optional hint content displayed inside a highlighted snippet.
   *
   * Defaults to `app/index.tsx`.
   */
  hint?: ReactNode;
};

/**
 * Small “hint” row used for developer/demo guidance.
 *
 * Renders the title plus a highlighted snippet/hint.
 */
export function HintRow({ title = 'Try editing', hint = 'app/index.tsx' }: HintRowProps) {
  return (
    <View style={styles.stepRow}>
      <ThemedText type="small">{title}</ThemedText>
      <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeSnippet: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
