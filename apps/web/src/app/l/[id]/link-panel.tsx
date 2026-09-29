"use client";

import type { PublicLinkDTO } from "@petrapay/shared";
import { CheckoutPanel } from "@/components/app/checkout/panel";
import { AmountHeading } from "@/components/app/checkout/utils";

/** The link's card. With a payer-chosen amount, the headline mirrors what they type. */
export function LinkPanel({ link, amount }: { link: PublicLinkDTO; amount: string }) {
  return (
    <CheckoutPanel creatorName={link.creatorName}>
      <p className="text-[13px] text-muted-foreground sm:pr-28 sm:text-sm">{link.amountType === "FIXED" ? "Payment" : "Pay what you want"}</p>
      <AmountHeading currency={link.currency} amount={amount} placeholder={link.currency === "USD" ? "$0.00" : "0 ZEC"} className="mt-3 sm:mt-4" />
      <p className="mt-2 text-base leading-snug text-pretty text-foreground/80 sm:mt-3 sm:text-lg">{link.title}</p>
      {link.description ? (
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground lg:line-clamp-none">{link.description}</p>
      ) : null}
    </CheckoutPanel>
  );
}
