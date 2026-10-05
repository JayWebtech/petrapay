import { formatZats, type LineItem, type LinkField } from "@petrapay/shared";
import type { Invoice, PaymentLink } from "../db.ts";
import { env } from "../env.ts";
import { isPastExpiry } from "./invoices.ts";

/**
 * Public API representations: snake_case, Stripe-style, with an `object` discriminator.
 * These are also the `data.object` of webhook events, so keep them stable.
 */

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function checkoutUrl(id: string) {
  return `${env.APP_ORIGIN}/pay/${id}`;
}

export function toCheckoutObject(invoice: Invoice) {
  // An open checkout past its expiry is reported as expired even before the sweep records it.
  const status = invoice.status === "OPEN" && isPastExpiry(invoice) ? "expired" : invoice.status.toLowerCase();
  return {
    id: invoice.id,
    object: "checkout" as const,
    url: checkoutUrl(invoice.id),
    status,
    number: invoice.number,
    currency: invoice.currency,
    amount: invoice.amount.toString(),
    title: invoice.title,
    description: invoice.description,
    line_items: (invoice.lineItems as LineItem[]).map((l) => ({ description: l.description, quantity: l.quantity, unit_amount: l.unitAmount })),
    reference: invoice.reference,
    metadata: (invoice.metadata as Record<string, string> | null) ?? {},
    customer: invoice.clientName || invoice.clientEmail ? { name: invoice.clientName, email: invoice.clientEmail } : null,
    success_url: invoice.successUrl,
    cancel_url: invoice.cancelUrl,
    payment_link: invoice.linkId,
    source: invoice.source === "LINK" ? "payment_link" : invoice.source.toLowerCase(),
    amount_received:
      invoice.receivedZats !== null ? { zec: formatZats(invoice.receivedZats), usd: invoice.receivedUsd?.toString() ?? null } : null,
    expires_at: iso(invoice.expiresAt),
    paid_at: iso(invoice.paidAt),
    created_at: invoice.createdAt.toISOString(),
  };
}

export function paymentLinkUrl(id: string) {
  return `${env.APP_ORIGIN}/l/${id}`;
}

export function toPaymentLinkObject(link: PaymentLink) {
  return {
    id: link.id,
    object: "payment_link" as const,
    url: paymentLinkUrl(link.id),
    active: link.active,
    title: link.title,
    description: link.description,
    currency: link.currency,
    amount_type: link.amountType.toLowerCase(),
    amount: link.amount?.toString() ?? null,
    min_amount: link.minAmount?.toString() ?? null,
    max_amount: link.maxAmount?.toString() ?? null,
    presets: link.presets as string[],
    fields: (link.fields as LinkField[]).map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, options: f.options ?? null })),
    created_at: link.createdAt.toISOString(),
  };
}
