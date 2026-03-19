import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

function ErrorFallback({ error, onReset }: { error: unknown; onReset: () => void }) {
  const colors = useNativeThemeColors();
  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppText style={[styles.title, { color: colors.error }]}>Something went wrong</AppText>
      <AppText style={styles.message} muted>
        {message}
      </AppText>
      <AppButton label="Try again" onPress={onReset} style={{ marginTop: 16 }} />
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
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 24 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  message: { fontSize: 13, fontWeight: '500', marginBottom: 0 },
});

