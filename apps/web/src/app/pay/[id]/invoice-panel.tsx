"use client";

import { formatAmount, formatUsd, type PublicInvoiceDTO } from "@petrapay/shared";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CheckoutPanel } from "@/components/app/checkout/panel";
import { AmountHeading, amountLabel } from "@/components/app/checkout/utils";
import { formatDate } from "@/components/app/invoice-row";
import { InvoiceStatusBadge, isOverdue } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

/** Who is asking, for what, and how much. Details fold away on small screens to keep the form in view. */
export function InvoicePanel({ invoice }: { invoice: PublicInvoiceDTO }) {
  const [open, setOpen] = useState(false);
  // A link payment is a single line named after the link, so the breakdown would only repeat the title.
  const showItems = !(invoice.lineItems.length === 1 && invoice.lineItems[0]!.description === invoice.title);
  const hasDetails = showItems || !!invoice.description;
  const count = invoice.lineItems.length;

  return (
    <CheckoutPanel creatorName={invoice.creatorName}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground sm:pr-28 sm:text-sm">
        {invoice.linkId ? "Payment" : `Invoice #${String(invoice.number).padStart(3, "0")}`}
        {invoice.dueDate ? <span>· Due {formatDate(invoice.dueDate, { month: "short", day: "numeric", year: "numeric" })}</span> : null}
        <InvoiceStatusBadge status={invoice.status} overdue={isOverdue(invoice)} />
      </p>
      <AmountHeading currency={invoice.currency} amount={invoice.amount} className="mt-3 sm:mt-4" />
      <p className="mt-2 text-base leading-snug text-pretty text-foreground/80 sm:mt-3 sm:text-lg">{invoice.title}</p>
      {invoice.clientName || invoice.clientEmail ? (
        <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm text-muted-foreground">
          Billed to <span className="font-medium text-foreground/80">{invoice.clientName ?? invoice.clientEmail}</span>
          {invoice.clientName && invoice.clientEmail ? <span className="hidden truncate lg:inline">· {invoice.clientEmail}</span> : null}
        </p>
      ) : null}

      {hasDetails ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-center justify-between gap-3 border-t border-border pt-3 text-left text-sm text-muted-foreground sm:mt-5 sm:pt-4 lg:hidden"
          aria-expanded={open}
        >
          <span>{showItems ? `${count} item${count === 1 ? "" : "s"}` : "Details"}</span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      ) : null}

      <div className={cn(open ? "block" : "hidden lg:block")}>
        {invoice.description ? (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground lg:mt-1.5">{invoice.description}</p>
        ) : null}
        {showItems ? (
          <>
            <div className="mt-3 divide-y divide-border border-t border-border lg:mt-5">
              {invoice.lineItems.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3 text-[15px]">
                  <span>
                    {item.description}
                    {item.quantity !== 1 ? <span className="text-muted-foreground"> × {item.quantity}</span> : null}
                  </span>
                  <span className="shrink-0 tabular">
                    {invoice.currency === "USD"
                      ? formatUsd(Number(item.unitAmount) * item.quantity)
                      : `${formatAmount(Number(item.unitAmount) * item.quantity, 8)} ZEC`}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-[15px] font-semibold">
              <span>Total due</span>
              <span className="tabular">{amountLabel(invoice)}</span>
            </div>
          </>
        ) : null}
      </div>
    </CheckoutPanel>
  );
}
