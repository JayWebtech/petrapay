import { formatAmount, formatUsd, type LinkField, type PublicLinkDTO } from "@petrapay/shared";

// Mirrors the API's limits so payers see problems before a round trip.
const MIN = { USD: 1, ZEC: 0.001 } as const;
const DECIMALS = { USD: 2, ZEC: 8 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const money = (currency: "USD" | "ZEC", value: string | number) => (currency === "USD" ? formatUsd(value) : `${formatAmount(value, 8)} ZEC`);

/** "$25" rather than "$25.00" for round suggested amounts. */
export const presetLabel = (currency: "USD" | "ZEC", value: string) => money(currency, value).replace(/\.00$/, "");

/** Keeps digits and one decimal point, capped at the currency's precision. */
export function sanitizeAmount(raw: string, currency: "USD" | "ZEC"): string {
  const cleaned = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, DECIMALS[currency])}`;
}

/** "Minimum $5.00 · Maximum $500.00", or null when the link has no bounds. */
export function rangeHint(link: PublicLinkDTO): string | null {
  const min = link.minAmount ? `Minimum ${money(link.currency, link.minAmount)}` : null;
  const max = link.maxAmount ? `Maximum ${money(link.currency, link.maxAmount)}` : null;
  return [min, max].filter(Boolean).join(" · ") || null;
}

export function amountError(link: PublicLinkDTO, amount: string): string | null {
  const n = Number(amount);
  if (!amount || !(n > 0)) return "Enter an amount";
  const floor = Math.max(MIN[link.currency], Number(link.minAmount ?? 0));
  if (n < floor) return `The minimum is ${money(link.currency, floor)}`;
  if (link.maxAmount && n > Number(link.maxAmount)) return `The maximum is ${money(link.currency, link.maxAmount)}`;
  return null;
}

export function fieldError(field: LinkField, value: string): string | null {
  const v = value.trim();
  if (!v) return field.required ? `${field.label} is required` : null;
  if (field.type === "email" && !EMAIL.test(v)) return "Enter a valid email address";
  if (field.type === "phone" && v.replace(/\D/g, "").length < 6) return "Enter a valid phone number";
  if (v.length > 1000) return "Keep this under 1,000 characters";
  return null;
}
