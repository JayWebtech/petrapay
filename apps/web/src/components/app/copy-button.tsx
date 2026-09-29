"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  text = "Copy",
  className,
  showLabel = false,
}: {
  value: string;
  /** Accessible name. */
  label?: string;
  /** Visible text when `showLabel` is set. */
  text?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "check" : "copy"}
            initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            transition={{ duration: 0.18 }}
            className="absolute"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {showLabel ? <span>{copied ? "Copied" : text}</span> : null}
    </button>
  );
}

/** Monospace value with a copy control, for addresses and amounts that must be exact. */
export function CopyField({ label, value, display, className }: { label: string; value: string; display?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/40 px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} showLabel />
      </div>
      <p className="mt-1 font-mono text-sm break-all text-foreground">{display ?? value}</p>
    </div>
  );
}
