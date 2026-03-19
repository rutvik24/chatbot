import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import {
  DEFAULT_TOAST_DURATION_MS,
  subscribeToast,
  type Toast,
} from '@/utils/toast-bus';

/**
 * Global toast overlay.
 *
 * Listens to `showToast()` events from `src/utils/toast-bus.ts` and displays a
 * temporary confirmation message at the bottom of the screen.
 */
export default function ToastOverlay() {
  const colors = useNativeThemeColors();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToast((nextToast) => {
      setToast(nextToast);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, nextToast.durationMs ?? DEFAULT_TOAST_DURATION_MS);
    });

    return () => {
      unsubscribe();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={styles.toastWrap}>
      <View style={[styles.toastInner, { backgroundColor: colors.surface }]}>
        <Text style={[styles.toastIcon, { color: colors.primary }]}>✓</Text>
        <Text style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>

        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              setToast(null);
            }}
            style={[
              styles.toastActionButton,
              { borderColor: colors.primary },
            ]}>
            <Text style={[styles.toastActionText, { color: colors.primary }]}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 86,
    zIndex: 50,
  },
  toastInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#323232',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastIcon: {
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.1,
    flex: 1,
  },
  toastActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  toastActionText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
});

