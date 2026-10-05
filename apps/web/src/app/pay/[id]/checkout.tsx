"use client";

import { ZEC_ASSET_ID, type PublicInvoiceDTO, type QuotePreviewDTO, type SwapDTO, type TokenDTO } from "@petrapay/shared";
import { ArrowLeft, Clock, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChooseStep } from "@/components/app/checkout/choose-step";
import { CheckoutFrame } from "@/components/app/checkout/frame";
import { ReviewStep } from "@/components/app/checkout/review-step";
import { paymentKey, rememberPayment } from "@/components/app/checkout/storage";
import { StepHeader, estimateIn, invoiceUsd } from "@/components/app/checkout/utils";
import { useNow } from "@/components/app/countdown";
import { TokenSelector } from "@/components/app/token-selector";
import { Loader } from "@/components/motion/loader";
import { useTokens } from "@/hooks/use-tokens";
import { api } from "@/lib/api";
import { DepositStep } from "./deposit-step";
import { InvoicePanel } from "./invoice-panel";
import { PaidState } from "./paid-state";
import { ZecDirect } from "./zec-direct";

const TERMINAL_FAIL = ["REFUNDED", "FAILED", "EXPIRED"];

type View = "choose" | "review" | "zec";

export function Checkout({ initial, initialView = "choose" }: { initial: PublicInvoiceDTO; initialView?: "choose" | "zec" }) {
  const { tokens } = useTokens();
  const [invoice, setInvoice] = useState(initial);
  const [view, setView] = useState<View>(initialView);
  const [token, setToken] = useState<TokenDTO | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const now = useNow(15_000);
  const [swap, setSwap] = useState<SwapDTO | null>(null);
  // True until we've checked for a payment this browser already started.
  const [resuming, setResuming] = useState(initial.status !== "PAID" && initial.status !== "CANCELLED");

  // Resume an in-progress payment after a reload.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(paymentKey(initial.id));
    } catch {
      // Storage blocked.
    }
    const lookup = saved
      ? api<{ swap: SwapDTO }>(`/public/invoices/${initial.id}/payments/${saved}`).then(({ swap }) => {
          if (!TERMINAL_FAIL.includes(swap.status)) setSwap(swap);
        })
      : Promise.resolve();
    lookup.catch(() => undefined).finally(() => setResuming(false));
  }, [initial.id]);

  const reset = useCallback(() => {
    setSwap(null);
    setView(token ? "review" : "choose");
    try {
      localStorage.removeItem(paymentKey(invoice.id));
    } catch {
      // ignore
    }
  }, [invoice.id, token]);

  const refreshInvoice = useCallback(async () => {
    try {
      setInvoice(await api<PublicInvoiceDTO>(`/public/invoices/${invoice.id}`));
    } catch {
      // Keep showing what we have.
    }
  }, [invoice.id]);

  const pick = (t: TokenDTO) => {
    setToken(t);
    setView("review");
  };

  const paid = invoice.status === "PAID" || swap?.status === "SUCCESS";
  const cancelled = invoice.status === "CANCELLED" && !swap;
  // Checkouts created through the API expire; one already being paid carries on.
  const expired = !swap && (invoice.status === "EXPIRED" || (invoice.status === "OPEN" && !!invoice.expiresAt && Date.parse(invoice.expiresAt) <= now));
  const stage = resuming ? "resuming" : paid ? "paid" : cancelled ? "cancelled" : expired ? "expired" : swap ? "deposit" : view;
  const backToStore = invoice.cancelUrl ? () => window.location.assign(invoice.cancelUrl!) : undefined;
  const usd = invoiceUsd(invoice);

  return (
    <CheckoutFrame
      panel={<InvoicePanel invoice={invoice} />}
      stage={stage}
      overlay={
        <TokenSelector
          open={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          tokens={tokens ?? []}
          exclude={[ZEC_ASSET_ID]}
          selectedId={token?.assetId}
          onSelect={pick}
          estimate={(t) => estimateIn(t, usd)}
          title="Pay with"
        />
      }
    >
      {stage === "resuming" ? (
        <div className="grid h-80 place-items-center text-muted-foreground">
          <Loader variant="dots" size={22} />
        </div>
      ) : stage === "paid" ? (
        <PaidState invoice={invoice} swap={swap} justPaid={initial.status !== "PAID"} />
      ) : stage === "expired" ? (
        <div>
          <StepHeader
            icon={<Clock className="size-6 text-muted-foreground" />}
            title="This checkout has expired"
            body={`Head back to ${invoice.creatorName} to start a new one. Nothing was charged.`}
          />
          {backToStore ? (
            <button type="button" onClick={backToStore} className="btn-solid mt-8 h-14 w-full text-[15px] font-semibold">
              <ArrowLeft className="size-4" /> Back to {invoice.creatorName}
            </button>
          ) : null}
        </div>
      ) : stage === "cancelled" ? (
        <StepHeader
          icon={<XCircle className="size-6 text-muted-foreground" />}
          title="This invoice was cancelled"
          body={`Reach out to ${invoice.creatorName} if you think this is a mistake.`}
        />
      ) : stage === "deposit" && swap ? (
        <DepositStep
          invoice={invoice}
          swap={swap}
          onUpdate={(next, invoiceStatus) => {
            setSwap(next);
            if (invoiceStatus && invoiceStatus !== invoice.status) void refreshInvoice();
          }}
          onReset={reset}
        />
      ) : stage === "review" && token ? (
        <ReviewStep
          payee={invoice.creatorName}
          token={token}
          fetchPreview={(originAsset) => api<QuotePreviewDTO>(`/public/invoices/${invoice.id}/quote`, { body: { originAsset, dry: true } })}
          commit={async (originAsset, refundTo) => {
            const next = await api<SwapDTO>(`/public/invoices/${invoice.id}/quote`, { body: { originAsset, refundTo, dry: false } });
            rememberPayment(invoice.id, next.id);
            setSwap(next);
          }}
          onChangeToken={() => setSelectorOpen(true)}
          onBack={() => setView("choose")}
        />
      ) : stage === "zec" ? (
        <ZecDirect invoice={invoice} onBack={() => setView("choose")} />
      ) : (
        <ChooseStep
          payee={invoice.creatorName}
          usd={usd}
          tokens={tokens}
          onPick={pick}
          onBrowse={() => setSelectorOpen(true)}
          onZec={() => setView("zec")}
          onBack={backToStore}
          backLabel={`Back to ${invoice.creatorName}`}
        />
      )}
    </CheckoutFrame>
  );
}
