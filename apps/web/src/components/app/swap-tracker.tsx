"use client";

import type { SwapStatus } from "@petrapay/shared";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { Loader } from "@/components/motion/loader";
import { cn } from "@/lib/utils";

const ORDER: SwapStatus[] = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS"];

function stepIndex(status: SwapStatus): number {
  if (status === "INCOMPLETE_DEPOSIT") return 1;
  if (status === "REFUNDED" || status === "FAILED") return 2;
  if (status === "EXPIRED") return 0;
  return ORDER.indexOf(status);
}

export function SwapTracker({ status, labels, className }: { status: SwapStatus; labels: [string, string, string, string]; className?: string }) {
  const current = stepIndex(status);
  const failed = status === "REFUNDED" || status === "FAILED" || status === "EXPIRED" || status === "INCOMPLETE_DEPOSIT";

  return (
    <ol className={cn("space-y-0", className)}>
      {labels.map((label, i) => {
        const done = i < current || status === "SUCCESS";
        const active = i === current && status !== "SUCCESS";
        const problem = active && failed;
        return (
          <li key={label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < labels.length - 1 ? (
              <span className="absolute top-7 left-[13px] h-[calc(100%-24px)] w-px bg-border">
                <motion.span
                  className="absolute inset-x-0 top-0 bg-primary"
                  initial={false}
                  animate={{ height: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && !problem && "border-primary/50 bg-accent text-accent-foreground",
                problem && "border-amber-500/40 bg-amber-500/10 text-amber-600",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-3.5" />
              ) : problem ? (
                status === "REFUNDED" ? <RotateCcw className="size-3.5" /> : status === "FAILED" ? <X className="size-3.5" /> : <AlertTriangle className="size-3.5" />
              ) : active ? (
                <Loader variant="spinner" size={14} />
              ) : (
                i + 1
              )}
            </span>
            <span className={cn("pt-1 text-sm", done || active ? "text-foreground" : "text-muted-foreground", active && "font-medium")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
