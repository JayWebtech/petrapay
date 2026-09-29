"use client";

import { formatAmount, formatUsd, type InvoiceDTO } from "@petrapay/shared";

export function formatInvoiceAmount(invoice: Pick<InvoiceDTO, "currency" | "amount">) {
  return invoice.currency === "USD" ? formatUsd(invoice.amount) : `${formatAmount(invoice.amount, 8)} ZEC`;
}

export function payUrl(id: string) {
  if (typeof window === "undefined") return `/pay/${id}`;
  return `${window.location.origin}/pay/${id}`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", opts);
}
