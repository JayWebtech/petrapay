"use client";

import { formatUsd, type PublicInvoiceDTO } from "@petrapay/shared";
import { Check, ExternalLink, Lock } from "lucide-react";
import { useState } from "react";
import { CopyField } from "@/components/app/copy-button";
import { QrCode } from "@/components/app/qr";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { api, errorMessage } from "@/lib/api";
import { StepHeader } from "@/components/app/checkout/utils";

/** Paying from a Zcash wallet: send straight to the invoice's shielded address, no swap needed. */
export function ZecDirect({ invoice, onBack }: { invoice: PublicInvoiceDTO; onBack: () => void }) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState(false);
  const direct = invoice.zecDirect;

  const report = async () => {
    setSending(true);
    try {
      await api(`/public/invoices/${invoice.id}/zec-sent`, { method: "POST" });
      setReported(true);
    } catch (err) {
      toast.error("Couldn't notify the creator", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <StepHeader
        onBack={onBack}
        icon={<Lock className="size-6" />}
        title="Pay with shielded ZEC"
        body="Scan with Zashi or any Orchard wallet. Nothing about this payment is visible on-chain, including to PetraPay."
      />

      {!direct ? (
        <p className="mt-8 rounded-3xl border border-border bg-[#fafafe] p-5 text-sm text-muted-foreground">
          Direct ZEC payment isn&apos;t available right now. Go back and pay with any token instead.
        </p>
      ) : (
        <>
          <div className="mt-8 flex flex-col items-center rounded-3xl border border-border bg-[#fafafe] p-6">
            <QrCode value={direct.uri} size={176} center="ZEC" />
            <a href={direct.uri} className="btn-soft mt-5 h-10 rounded-xl px-4 text-sm font-medium">
              Open in wallet <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className="mt-4 space-y-2">
            <CopyField
              label="Amount"
              value={direct.amountZec}
              display={`${direct.amountZec} ZEC${invoice.zecPriceUsd && invoice.currency === "USD" ? ` · ${formatUsd(invoice.amount)} at ${formatUsd(invoice.zecPriceUsd)}` : ""}`}
            />
            <CopyField label="Shielded address" value={direct.address} />
          </div>
          {reported ? (
            <p className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <Check className="size-4" /> Thanks! {invoice.creatorName} will confirm once it lands.
            </p>
          ) : (
            <button type="button" onClick={report} disabled={sending} className="btn-solid mt-6 h-14 w-full text-[15px] font-semibold">
              {sending ? <Loader variant="spinner" size={16} /> : <Check className="size-4" />}
              I&apos;ve sent the ZEC
            </button>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">Shielded payments can&apos;t be detected automatically, so this lets {invoice.creatorName} know to check.</p>
        </>
      )}
    </div>
  );
}
