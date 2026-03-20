export type ToastAction = {
  label: string;
  onPress: () => void;
};

/** Visual tone + icon. Defaults to `success` for string-only `showToast("…")` calls. */
export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  message: string;
  /** Short headline (e.g. “Copied”). Shown above `message` when set. */
  title?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  durationMs?: number;
};

/** @deprecated Prefer {@link resolveToastDuration} — kept for older call sites. */
export const DEFAULT_TOAST_DURATION_MS = 3000;

/** Readable time on screen: errors stay a bit longer so people can act. */
export function resolveToastDuration(toast: Toast): number {
  if (typeof toast.durationMs === "number") return toast.durationMs;
  switch (toast.variant ?? "success") {
    case "error":
      return 4200;
    case "info":
      return 3400;
    default:
      return 2800;
  }
}

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
    typeof toastOrMessage === "string"
      ? { message: toastOrMessage, variant: "success", durationMs }
      : {
          ...toastOrMessage,
          variant: toastOrMessage.variant ?? "success",
          ...(typeof durationMs === "number" ? { durationMs } : {}),
        };

  for (const listener of listeners) {
    listener(toast);
  }
}

