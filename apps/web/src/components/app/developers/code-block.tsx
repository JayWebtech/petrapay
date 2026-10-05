"use client";

import { useState } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { cn } from "@/lib/utils";

export type CodeSample = { label: string; code: string };

/** Dark code panel with optional language tabs and a copy button. */
export function CodeBlock({ samples, className }: { samples: CodeSample[]; className?: string }) {
  const [active, setActive] = useState(0);
  const current = samples[active] ?? samples[0]!;
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-[#0b0a24] text-[#e7e5ff] shadow-[0_18px_40px_-24px_rgba(11,10,36,0.6)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex gap-1" role="tablist">
          {samples.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                i === active ? "bg-white/12 text-white" : "text-white/55 hover:text-white",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <CopyButton value={current.code} label="Copy code" showLabel className="text-white/70 hover:bg-white/10 hover:text-white" />
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
        <code className="font-mono">{current.code}</code>
      </pre>
    </div>
  );
}
