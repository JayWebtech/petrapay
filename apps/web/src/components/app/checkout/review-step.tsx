"use client";

import { chainMeta, formatAmount, formatUsd, type QuotePreviewDTO, type TokenDTO } from "@petrapay/shared";
import { ArrowRight, Lock, Wallet } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { useToast } from "@/components/app/toaster";
import { TokenIcon } from "@/components/app/token-icon";
import { fieldClass } from "@/components/app/field";
import { Loader } from "@/components/motion/loader";
import { useWalletAvailable } from "@/hooks/use-wallet";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { connectEvm } from "@/lib/wallets/evm";
import { connectSolana } from "@/lib/wallets/solana";
import { StepHeader } from "./utils";

const PREVIEW_REFRESH_MS = 30_000;

/** Live quote for paying with `token`, the payer's refund address, and the commit button. */
export function ReviewStep({
  payee,
  token,
  fetchPreview,
  commit,
  onChangeToken,
  onBack,
}: {
  payee: string;
  token: TokenDTO;
  fetchPreview: (originAsset: string) => Promise<QuotePreviewDTO>;
  /** Locks the quote and moves on. Stays pending until the parent swaps this step out. */
  commit: (originAsset: string, refundTo: string) => Promise<void>;
  onChangeToken: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const meta = chainMeta(token.blockchain);
  const canConnect = useWalletAvailable(meta.wallet);
  // Results are tagged with the token they belong to, so switching never shows a stale quote.
  const [quote, setQuote] = useState<{ assetId: string; preview?: QuotePreviewDTO; error?: string } | null>(null);
  const [refundTo, setRefundTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPreview = useEffectEvent((originAsset: string) => fetchPreview(originAsset));

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const q = await loadPreview(token.assetId);
        if (alive) setQuote({ assetId: token.assetId, preview: q });
      } catch (err) {
        if (alive) setQuote({ assetId: token.assetId, error: errorMessage(err) });
      }
    };
    void run();
    const id = window.setInterval(run, PREVIEW_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token.assetId]);

  const current = quote?.assetId === token.assetId ? quote : null;
  const preview = current?.preview ?? null;

  const connect = async () => {
    try {
      setRefundTo(meta.wallet === "evm" ? await connectEvm() : await connectSolana());
    } catch (err) {
      toast.error("Wallet connection failed", errorMessage(err));
    }
  };

  const start = async () => {
    setSubmitting(true);
    try {
      await commit(token.assetId, refundTo.trim());
    } catch (err) {
      toast.error("Couldn't start payment", errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <StepHeader
        onBack={onBack}
        icon={<TokenIcon symbol={token.symbol} chain={token.blockchain} size={30} />}
        title="Review your payment"
        body="Live quote, refreshed every 30 seconds until you continue."
      />

      <button type="button" onClick={onChangeToken} className="btn-soft mt-8 h-16 w-full justify-between px-4 text-left">
        <span className="flex items-center gap-3">
          <TokenIcon symbol={token.symbol} chain={token.blockchain} size={34} />
          <span>
            <span className="block text-[15px] font-semibold">{token.symbol}</span>
            <span className="block text-xs text-muted-foreground">on {meta.name}</span>
          </span>
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">Change</span>
      </button>

      <div className="mt-4 rounded-3xl border border-border bg-[#fafafe] p-5">
        {!current ? (
          <div className="space-y-3" aria-label="Fetching quote" role="status">
            <div className="flex items-end justify-between">
              <span className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              <span className="h-6 w-36 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="h-3 w-24 animate-pulse rounded-full bg-muted" />
              <span className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex justify-between">
              <span className="h-3 w-14 animate-pulse rounded-full bg-muted" />
              <span className="h-3 w-44 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ) : current.error ? (
          <p className="py-6 text-center text-sm text-destructive">{current.error}</p>
        ) : preview ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-end justify-between gap-4">
              <span className="text-muted-foreground">You send</span>
              <span className="text-right">
                <span className="block text-xl font-semibold tracking-tight tabular">
                  {formatAmount(preview.amountInFormatted, 6)} {token.symbol}
                </span>
                <span className="text-xs text-muted-foreground tabular">≈ {formatUsd(preview.amountInUsd)} incl. fees</span>
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{payee} receives</span>
              <span className="inline-flex items-center gap-1.5 font-medium tabular">
                <Lock className="size-3.5 text-primary" />
                {formatAmount(preview.amountOutFormatted, 6)} ZEC
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Arrives</span>
              <span className="tabular">~{Math.max(1, Math.round(preview.timeEstimate / 60))} min after your transfer confirms</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="refund" className="text-sm font-medium">
            Your {meta.name} address
          </label>
          {/* {canConnect ? (
            <button type="button" onClick={connect} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Wallet className="size-3.5" /> Use my wallet
            </button>
          ) : null} */}
        </div>
        <input
          id="refund"
          value={refundTo}
          onChange={(e) => setRefundTo(e.target.value.trim())}
          spellCheck={false}
          autoComplete="off"
          placeholder={meta.addressHint}
          className={cn(fieldClass, "h-14 font-mono text-sm")}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Only used to refund you if the swap can&apos;t complete. Use an address you control, not an exchange.
        </p>
      </div>

      <button
        type="button"
        onClick={start}
        disabled={!preview || refundTo.length < 8 || submitting}
        className={cn("btn-solid mt-8 h-14 w-full text-[15px] font-semibold")}
      >
        {submitting ? (
          <>
            <Loader variant="spinner" size={16} /> Locking your quote
          </>
        ) : (
          <>
            Continue to payment <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  );
}
