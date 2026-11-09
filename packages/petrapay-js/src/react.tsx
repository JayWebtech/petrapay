import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { buttonStyle, type ButtonAppearance } from "./button";
import { openCheckout, type CheckoutHandle, type CheckoutOptions } from "./core";

export * from "./index";

/**
 * Opens the PetraPay checkout from your own UI.
 *
 *   const { open, status } = usePetraPay({ paymentId: "abc123", onSuccess: (p) => ... });
 *   <button onClick={() => open()}>Pay</button>
 */
export function usePetraPay(defaults: CheckoutOptions) {
  const handle = useRef<CheckoutHandle | null>(null);
  const latest = useRef(defaults);
  const [status, setStatus] = useState<"idle" | "open" | "processing" | "paid">("idle");

  useEffect(() => {
    latest.current = defaults;
  });

  useEffect(() => () => handle.current?.close(), []);

  const open = useCallback((overrides?: Partial<CheckoutOptions>) => {
    const o = { ...latest.current, ...overrides } as CheckoutOptions;
    setStatus("open");
    handle.current = openCheckout({
      ...o,
      onProcessing: (e) => {
        setStatus("processing");
        o.onProcessing?.(e);
      },
      onSuccess: (e) => {
        setStatus("paid");
        o.onSuccess?.(e);
      },
      onClose: (r) => {
        setStatus(r.paid ? "paid" : "idle");
        o.onClose?.(r);
      },
    });
  }, []);

  const close = useCallback(() => handle.current?.close(), []);

  return { open, close, status };
}

export type PetraPayButtonProps = CheckoutOptions &
  ButtonAppearance & {
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
    /** Replaces the default logo and label. */
    children?: ReactNode;
  };

/**
 * <PetraPayButton paymentId="abc123" amount={total} onSuccess={(p) => ...} />
 */
export function PetraPayButton({ label, theme = "dark", size = "medium", block, disabled, className, style, children, ...options }: PetraPayButtonProps) {
  const { open, status } = usePetraPay(options);
  const busy = status === "open" || status === "processing";
  const [pressed, setPressed] = useState(false);
  const base = buttonStyle({ theme, size, block }, disabled) as CSSProperties;
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={() => open()}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...base, transform: pressed ? "translateY(1px)" : undefined, ...style }}
    >
      {children ?? (
        <>
          <Logo color={theme === "dark" ? "#ffffff" : "#072ac8"} />
          <span>{label ?? "Pay with PetraPay"}</span>
        </>
      )}
    </button>
  );
}

function Logo({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 32 32" width={20} height={20} aria-hidden="true" focusable="false">
      <path d="M16 2 28 9v14l-12 7-12-7V9z" fill={color} />
      <path d="M16 2v28l12-7V9z" fill="#000" fillOpacity=".18" />
      <path d="M4 9l12 7 12-7" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" />
      <path d="M16 16v14" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" />
    </svg>
  );
}
