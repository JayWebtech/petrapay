"use client";

import { chainMeta, formatAmount, type PublicInvoiceDTO, type SwapDTO } from "@petrapay/shared";
import { ArrowRight, Check, ExternalLink, Lock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { formatDate } from "@/components/app/invoice-row";
import { TokenIcon } from "@/components/app/token-icon";

const REDIRECT_SECONDS = 5;

/** Sends the customer back to the merchant's site. Counts down only right after paying, not on a revisited receipt. */
function ReturnToMerchant({ invoice, auto }: { invoice: PublicInvoiceDTO; auto: boolean }) {
  const url = invoice.successUrl!.replaceAll("{CHECKOUT_ID}", encodeURIComponent(invoice.id));
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const [stay, setStay] = useState(!auto);

  useEffect(() => {
    if (stay) return;
    if (left <= 0) {
      window.location.assign(url);
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, stay, url]);

  return (
    <div className="mt-8">
      <a href={url} className="btn-solid h-14 w-full text-[15px] font-semibold">
        Continue to {invoice.creatorName} <ArrowRight className="size-4" />
      </a>
      {!stay ? (
        <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
          Taking you back in {left}s ·{" "}
          <button type="button" onClick={() => setStay(true)} className="font-medium text-foreground underline-offset-2 hover:underline">
            Stay here
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function PaidState({ invoice, swap, justPaid = false }: { invoice: PublicInvoiceDTO; swap: SwapDTO | null; justPaid?: boolean }) {
  const reduce = useReducedMotion();
  const paidAt = swap?.settledAt ?? invoice.paidAt;
  return (
    <div>
      <motion.span
        initial={reduce ? false : { scale: 0.5, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 20 }}
        className="grid size-14 place-items-center rounded-[18px] bg-primary text-white shadow-[0_4px_0_0_#271a95]"
      >
        <Check className="size-7" strokeWidth={2.5} />
      </motion.span>
      <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-[-0.03em]">Payment complete</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        {swap
          ? `${formatAmount(swap.amountOutFormatted, 6)} ZEC was delivered privately to ${invoice.creatorName}.`
          : `${invoice.creatorName} has received this payment.`}
      </p>
      {invoice.successUrl ? <ReturnToMerchant invoice={invoice} auto={justPaid} /> : null}


      {swap ? (
        <div className="mt-8 rounded-3xl border border-border bg-white p-5 shadow-[0_3px_0_0_#eeedf5]">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <TokenIcon symbol={swap.originSymbol} chain={swap.originChain} size={38} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">You paid</p>
              <p className="font-semibold tabular">
                {formatAmount(swap.amountInFormatted, 6)} {swap.originSymbol}{" "}
                <span className="font-normal text-muted-foreground">on {chainMeta(swap.originChain).name}</span>
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Settled as</dt>
              <dd className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5 text-primary" /> Shielded ZEC
              </dd>
            </div>
            {paidAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="tabular">{formatDate(paidAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>#{String(invoice.number).padStart(3, "0")}</dd>
            </div>
          </dl>
          {swap.originTxs[0] ? (
            <a href={swap.originTxs[0].explorerUrl} target="_blank" rel="noreferrer" className="btn-soft mt-5 h-11 w-full rounded-xl text-sm font-medium">
              View your transaction <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="mt-6 text-center text-xs text-muted-foreground">You can close this page. Keep the link as your receipt.</p>
    </div>
  );
}
