"use client";

import type { BillTo, InvoiceDTO } from "@petrapay/shared";
import { useEffect, useState, useSyncExternalStore } from "react";
import { payUrl } from "@/components/app/invoice-row";
import { identityVersion, subscribeIdentity } from "@/lib/identity";
import { openBillTo, openShareKey, withShareKey } from "@/lib/share-key";
import { useNote } from "./use-note";

type Shareable = Pick<InvoiceDTO, "id" | "billTo" | "billToKey" | "clientLabel">;

export type InvoiceShare = {
  /** Payment link, including the #fragment key once this device has recovered it. */
  url: string;
  key: string | null;
  /** "none": no client details. "locked": this device can't decrypt them. */
  status: "none" | "opening" | "locked" | "open";
  client: { name?: string; email?: string };
};

/** Decrypts an invoice's share key and client details on the creator's device. */
export function useInvoiceShare(invoice: Shareable): InvoiceShare {
  const version = useSyncExternalStore(subscribeIdentity, identityVersion, () => 0);
  const token = invoice.billToKey ? `${version}:${invoice.billToKey}:${invoice.billTo}` : null;
  const [opened, setOpened] = useState<{ token: string; key: string | null; billTo: BillTo | null } | null>(null);
  // Invoices from before client details existed only have the private client note.
  const legacyName = useNote(invoice.billToKey ? null : invoice.clientLabel);

  useEffect(() => {
    if (!token || !invoice.billToKey) return;
    let alive = true;
    (async () => {
      const key = await openShareKey(invoice.billToKey!);
      const billTo = key && invoice.billTo ? await openBillTo(key, invoice.billTo) : null;
      if (alive) setOpened({ token, key, billTo });
    })();
    return () => {
      alive = false;
    };
  }, [token, invoice.billToKey, invoice.billTo]);

  const base = payUrl(invoice.id);
  if (!token) {
    return legacyName ? { url: base, key: null, status: "open", client: { name: legacyName } } : { url: base, key: null, status: "none", client: {} };
  }
  if (opened?.token !== token) return { url: base, key: null, status: "opening", client: {} };
  if (!opened.key) return { url: base, key: null, status: "locked", client: {} };
  return {
    url: withShareKey(base, opened.key),
    key: opened.key,
    status: invoice.billTo ? (opened.billTo ? "open" : "locked") : "none",
    client: { name: opened.billTo?.name, email: opened.billTo?.email },
  };
}
