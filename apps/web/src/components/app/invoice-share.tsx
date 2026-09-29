"use client";

import type { InvoiceDTO } from "@petrapay/shared";
import { Lock } from "lucide-react";
import { useInvoiceShare } from "@/hooks/use-invoice-share";
import { CopyButton } from "./copy-button";

type Shareable = Pick<InvoiceDTO, "id" | "billTo" | "billToKey" | "clientLabel">;

/** Copies the payment link, with the key that lets the client read who it's billed to. */
export function ShareCopyButton({ invoice, className }: { invoice: Shareable; className?: string }) {
  const share = useInvoiceShare(invoice);
  return <CopyButton value={share.url} label="Copy payment link" className={className} />;
}

/** The client's name (or email) for lists. */
export function ClientName({ invoice, fallback = "—" }: { invoice: Shareable; fallback?: string }) {
  const share = useInvoiceShare(invoice);
  if (share.status === "none") return fallback;
  if (share.status === "opening") return "…";
  if (share.status === "locked") {
    return (
      <span className="inline-flex items-center gap-1">
        <Lock className="size-3" /> Encrypted
      </span>
    );
  }
  return share.client.name || share.client.email || fallback;
}
