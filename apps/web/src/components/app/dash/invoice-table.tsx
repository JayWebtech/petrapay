"use client";

import { formatAmount, formatUsd, type InvoiceDTO } from "@petrapay/shared";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClientName, ShareCopyButton } from "../invoice-share";
import { InvoicePill } from "./ui";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Amount({ invoice }: { invoice: InvoiceDTO }) {
  if (invoice.currency === "USD") {
    return (
      <>
        <span className="font-semibold">{formatUsd(invoice.amount)}</span> <span className="text-xs text-muted-foreground">USD</span>
      </>
    );
  }
  return (
    <>
      <span className="font-semibold">{formatAmount(invoice.amount, 6)}</span> <span className="text-xs text-muted-foreground">ZEC</span>
    </>
  );
}

/** Stripe-style list: amount first, then status, what it's for, who, and when. Rows open the invoice. */
export function InvoiceTable({ invoices, compact = false }: { invoices: InvoiceDTO[] | null; compact?: boolean }) {
  const router = useRouter();

  if (invoices === null) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: compact ? 4 : 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <span className="h-4 w-20 animate-pulse rounded bg-muted" />
            <span className="h-5 w-14 animate-pulse rounded-md bg-muted" />
            <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-14 text-center">
        <span className="icon-tile size-12">
          <FileText className="size-5 text-muted-foreground" />
        </span>
        <p className="mt-4 text-sm font-semibold">No invoices yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Create one and share the link. Your client can pay with any token.</p>
        <Link href="/dashboard/invoices/new" className="btn-solid mt-5 h-10 rounded-xl px-4 text-sm font-semibold">
          <Plus className="size-4" /> Create invoice
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", compact ? "min-w-[480px]" : "min-w-[720px]")}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2.5 pr-3 pl-5 font-medium">Amount</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Invoice</th>
            {!compact ? <th className="px-3 py-2.5 font-medium">Client</th> : null}
            <th className="px-3 py-2.5 font-medium">{compact ? "Created" : "Due"}</th>
            {!compact ? <th className="px-3 py-2.5 font-medium">Created</th> : null}
            <th className="w-10 py-2.5 pr-5 pl-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
              className="group cursor-pointer transition-colors hover:bg-[#fafafe]"
            >
              <td className="py-3.5 pr-3 pl-5 whitespace-nowrap tabular">
                <Link href={`/dashboard/invoices/${inv.id}`} onClick={(e) => e.stopPropagation()} className="outline-none focus-visible:underline">
                  <Amount invoice={inv} />
                </Link>
              </td>
              <td className="px-3 py-3.5">
                <InvoicePill status={inv.status} dueDate={inv.dueDate} />
              </td>
              <td className="max-w-[260px] px-3 py-3.5">
                <p className="truncate font-medium">{inv.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">#{String(inv.number).padStart(3, "0")}</p>
              </td>
              {!compact ? (
                <td className="max-w-[180px] truncate px-3 py-3.5 text-muted-foreground">
                  <ClientName invoice={inv} />
                </td>
              ) : null}
              <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">{compact ? date(inv.createdAt) : inv.dueDate ? date(inv.dueDate) : "—"}</td>
              {!compact ? <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">{date(inv.createdAt)}</td> : null}
              <td className="py-3.5 pr-5 pl-3" onClick={(e) => e.stopPropagation()}>
                <ShareCopyButton invoice={inv} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
