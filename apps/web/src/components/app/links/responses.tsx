"use client";

import { Lock } from "lucide-react";
import { CopyButton } from "@/components/app/copy-button";
import { useResponses } from "@/hooks/use-responses";

/** A payer's answers, decrypted on this device. */
export function ResponsesList({ sealed }: { sealed: string | null }) {
  const opened = useResponses(sealed);
  if (opened.status === "none") return <p className="px-5 py-6 text-sm text-muted-foreground">The payer didn&apos;t fill in any fields.</p>;
  if (opened.status === "opening") {
    return (
      <div className="space-y-3 px-5 py-4" role="status" aria-label="Decrypting">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5">
            <span className="block h-3 w-16 animate-pulse rounded-full bg-muted" />
            <span className="block h-4 w-40 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (opened.status === "locked") {
    return (
      <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
        <Lock className="size-4 text-primary" /> Encrypted. Unlock with your recovery phrase on this device to read it.
      </p>
    );
  }
  return (
    <dl className="divide-y divide-border">
      {opened.fields.map((f) => (
        <div key={f.id} className="group flex items-start justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="mt-0.5 text-sm break-words whitespace-pre-line">{f.value}</dd>
          </div>
          <CopyButton
            value={f.value}
            label={`Copy ${f.label}`}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          />
        </div>
      ))}
    </dl>
  );
}

/** One-line preview of the first answers, for tables. */
export function ResponsesSummary({ sealed }: { sealed: string | null }) {
  const opened = useResponses(sealed);
  if (opened.status === "none") return <span className="text-muted-foreground">—</span>;
  if (opened.status === "opening") return <span className="inline-block h-3.5 w-28 animate-pulse rounded-full bg-muted align-middle" />;
  if (opened.status === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Lock className="size-3.5" /> Encrypted
      </span>
    );
  }
  return <span className="block max-w-[260px] truncate">{opened.fields.map((f) => f.value).join(" · ")}</span>;
}
