"use client";

import type { PublicInvoiceDTO } from "@petrapay/shared";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { api, errorMessage } from "@/lib/api";

/**
 * Shown only on test sales (rung up by a POS terminal in test mode). The server checks the
 * sale's own test flag, so this can't be used to skip paying for a real sale.
 */
export function TestPayment({ invoice, onPaid }: { invoice: PublicInvoiceDTO; onPaid: (next: PublicInvoiceDTO) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const simulate = async () => {
    setBusy(true);
    try {
      onPaid(await api<PublicInvoiceDTO>(`/public/invoices/${invoice.id}/simulate`, { method: "POST" }));
    } catch (err) {
      toast.error("Couldn't simulate the payment", errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-dashed border-[#f0b46b] bg-[#fff7ec] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#8a4b00]">
        <FlaskConical className="size-4" /> Test sale: no real money
      </p>
      <p className="mt-1 text-sm text-[#8a4b00]/80">This came from a point-of-sale terminal in test mode. Simulate the payment to try the full flow, receipt included.</p>
      <button type="button" onClick={simulate} disabled={busy} className="btn-solid mt-3 h-11 w-full rounded-xl text-sm font-semibold">
        {busy ? <Loader variant="spinner" size={14} /> : null} Simulate payment
      </button>
    </div>
  );
}
