"use client";

import type { InvoiceDTO } from "@petrapay/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InvoiceForm, editBlocker } from "@/components/app/invoice-form";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { useInvoiceShare } from "@/hooks/use-invoice-share";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, error } = useApi<InvoiceDTO>(`/invoices/${id}`);

  if (error && !invoice) return <p className="text-sm text-destructive">{error}</p>;
  if (!invoice) return <Loading />;
  return <EditLoaded invoice={invoice} />;
}

function EditLoaded({ invoice }: { invoice: InvoiceDTO }) {
  const share = useInvoiceShare(invoice);
  const blocked = editBlocker(invoice);

  if (blocked) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">This invoice can&apos;t be edited</h1>
        <p className="mt-2 text-sm text-muted-foreground">{blocked}</p>
        <Link href={`/dashboard/invoices/${invoice.id}`} className="btn-soft mt-6 h-10 rounded-xl px-4 text-sm font-medium">
          <ArrowLeft className="size-4" /> Back to invoice
        </Link>
      </div>
    );
  }
  // Wait for the client details to decrypt so the form starts with them filled in.
  if (share.status === "opening") return <Loading />;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/invoices/${invoice.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Invoice #{String(invoice.number).padStart(3, "0")}
      </Link>
      <InvoiceForm
        invoice={invoice}
        // A legacy private client note is never copied into details the payer can see.
        client={share.key ? share.client : undefined}
        shareKey={share.key}
        clientLocked={share.status === "locked"}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="grid h-64 place-items-center text-muted-foreground">
      <Loader variant="dots" size={24} />
    </div>
  );
}
