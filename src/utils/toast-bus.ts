export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type Toast = {
  message: string;
  action?: ToastAction;
  durationMs?: number;
};

type ToastListener = (toast: Toast) => void;

let listeners: ToastListener[] = [];

export function subscribeToast(listener: ToastListener): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function showToast(toastOrMessage: string | Toast) {
  const toast: Toast =
    typeof toastOrMessage === 'string'
      ? { message: toastOrMessage }
      : toastOrMessage;

  for (const listener of listeners) {
    listener(toast);
  }
}

