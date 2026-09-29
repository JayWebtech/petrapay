"use client";

import type { InvoiceDTO } from "@petrapay/shared";
import { NoteText } from "@/hooks/use-note";

/** Who an invoice is billed to, for lists. Older invoices only have the private client note. */
export function ClientName({ invoice, fallback = "—" }: { invoice: Pick<InvoiceDTO, "clientName" | "clientEmail" | "clientLabel">; fallback?: string }) {
  if (invoice.clientName || invoice.clientEmail) return invoice.clientName ?? invoice.clientEmail;
  return <NoteText value={invoice.clientLabel} fallback={fallback} />;
}
