import type { WebMcpToast } from "./types";

type ToastListener = (toasts: WebMcpToast[]) => void;

let activeToasts: WebMcpToast[] = [];
const listeners = new Set<ToastListener>();

export function emitWebMcpToast(
  icon: string,
  title: string,
  detail: string,
  type: WebMcpToast["type"] = "info"
) {
  const newToast: WebMcpToast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    icon,
    title,
    detail,
    timestamp: Date.now(),
    type,
  };

  activeToasts = [...activeToasts, newToast];
  listeners.forEach((listener) => listener(activeToasts));

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    activeToasts = activeToasts.filter((t) => t.id !== newToast.id);
    listeners.forEach((listener) => listener(activeToasts));
  }, 5000);
}

export function subscribeToWebMcpToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener(activeToasts);
  return () => {
    listeners.delete(listener);
  };
}
