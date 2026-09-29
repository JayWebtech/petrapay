import { formatAmount, formatUsd, type PaymentLinkDTO } from "@petrapay/shared";

export function linkUrl(id: string) {
  if (typeof window === "undefined") return `/l/${id}`;
  return `${window.location.origin}/l/${id}`;
}

export const money = (currency: "USD" | "ZEC", value: string | number) => (currency === "USD" ? formatUsd(value) : `${formatAmount(value, 8)} ZEC`);

type Priced = Pick<PaymentLinkDTO, "currency" | "amountType" | "amount" | "minAmount" | "maxAmount">;

/** "$25.00", "Customer chooses", "From $5.00", "$5.00 – $500.00". */
export function priceLabel(link: Priced): string {
  if (link.amountType === "FIXED" && link.amount) return money(link.currency, link.amount);
  if (link.minAmount && link.maxAmount) return `${money(link.currency, link.minAmount)} – ${money(link.currency, link.maxAmount)}`;
  if (link.minAmount) return `From ${money(link.currency, link.minAmount)}`;
  if (link.maxAmount) return `Up to ${money(link.currency, link.maxAmount)}`;
  return "Customer chooses";
}
