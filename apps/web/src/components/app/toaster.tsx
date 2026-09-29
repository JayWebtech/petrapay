"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { AnimatedToastStack, useAnimatedToastStack, type ToastInput } from "@/components/motion/animated-toast-stack";

type ToastApi = {
  toast: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  update: (id: string, input: Partial<ToastInput>) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({ defaultDuration: 3600, limit: 4 });

  const success = useCallback((title: string, description?: string) => showToast({ status: "success", title, description }), [showToast]);
  const error = useCallback(
    (title: string, description?: string) => showToast({ status: "error", title, description, duration: 6000 }),
    [showToast],
  );
  const value = useMemo<ToastApi>(
    () => ({ toast: showToast, success, error, update: updateToast }),
    [showToast, success, error, updateToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-right" placement="fixed" maxVisible={3} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
