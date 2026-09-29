"use client";

import type { ReactNode } from "react";
import { Input, type InputProps } from "@/components/motion/input";
import { cn } from "@/lib/utils";

/**
 * One field style for every form: 48px, rounded-2xl, a soft bottom edge, indigo focus ring.
 * Native inputs and textareas use these class strings; text fields use <TextField>.
 */
export const fieldClass =
  "h-12 w-full rounded-2xl border border-border bg-white px-4 text-[15px] text-foreground shadow-[0_2px_0_0_#eeedf5] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "w-full resize-none rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-foreground shadow-[0_2px_0_0_#eeedf5] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10";

export function FieldLabel({ htmlFor, children, action }: { htmlFor?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      {action}
    </div>
  );
}

export function FieldHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-2 text-xs leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

/** beUI Input (error shake, success check) dressed in the shared field style. */
export function TextField({ hint, mono, classNames, ...props }: InputProps & { hint?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <Input
        {...props}
        classNames={{
          ...classNames,
          root: cn("gap-2", classNames?.root),
          label: cn("px-0", classNames?.label),
          field: cn(
            "h-12 rounded-2xl border-border bg-white shadow-[0_2px_0_0_#eeedf5]",
            "data-[state=focused]:border-primary/50 data-[state=focused]:ring-4 data-[state=focused]:ring-primary/10",
            "data-[state=error]:ring-4",
            classNames?.field,
          ),
          input: cn("px-4 text-[15px]", mono && "font-mono text-sm", classNames?.input),
        }}
      />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
