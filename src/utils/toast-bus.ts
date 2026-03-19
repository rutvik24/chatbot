export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type Toast = {
  message: string;
  action?: ToastAction;
  durationMs?: number;
};

export const DEFAULT_TOAST_DURATION_MS = 3000;

type ToastListener = (toast: Toast) => void;

let listeners: ToastListener[] = [];

export function subscribeToast(listener: ToastListener): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function showToast(toastOrMessage: string | Toast, durationMs?: number) {
  const toast: Toast =
    typeof toastOrMessage === 'string'
      ? { message: toastOrMessage, durationMs }
      : {
          ...toastOrMessage,
          ...(typeof durationMs === 'number' ? { durationMs } : {}),
        };

  for (const listener of listeners) {
    listener(toast);
  }
}

