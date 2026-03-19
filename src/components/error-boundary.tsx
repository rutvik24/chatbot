import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

function ErrorFallback({ error, onReset }: { error: unknown; onReset: () => void }) {
  const colors = useNativeThemeColors();
  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: '#000',
            },
          ]}>
          <View style={styles.iconRow}>
            <SymbolView
              name={{
                ios: 'exclamationmark.triangle.fill',
                android: 'error_outline',
                web: 'warning',
              }}
              size={26}
              tintColor={colors.error}
            />
          </View>

          <AppText style={[styles.title, { color: colors.error }]}>
            Something went wrong
          </AppText>

          <View style={[styles.messageBox, { borderColor: colors.border }]}>
            <Text style={[styles.messageText, { color: colors.secondaryText }]}>
              {message}
            </Text>
          </View>

          <View style={styles.actions}>
            <AppButton
              label="Try again"
              onPress={onReset}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

export default class ErrorBoundary extends React.Component<{
  children: React.ReactNode;
}> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', { error, info });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  iconRow: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  messageBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actions: {
    alignItems: 'stretch',
  },
});

