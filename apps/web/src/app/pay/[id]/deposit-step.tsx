"use client";

import { chainMeta, formatAmount, formatUsd, type InvoiceStatus, type PublicInvoiceDTO, type SwapDTO } from "@petrapay/shared";
import { AlertTriangle, ArrowDownToLine, ArrowLeft, Check, ChevronRight, Clock, DoorOpen, ExternalLink, Wallet } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { CopyButton, CopyField } from "@/components/app/copy-button";
import { Countdown, formatDuration, useNow } from "@/components/app/countdown";
import { QrCode } from "@/components/app/qr";
import { SwapTracker } from "@/components/app/swap-tracker";
import { useToast } from "@/components/app/toaster";
import { TokenIcon } from "@/components/app/token-icon";
import { fieldClass } from "@/components/app/field";
import { type ButtonState } from "@/components/motion/button";
import { Loader } from "@/components/motion/loader";
import { useTokens } from "@/hooks/use-tokens";
import { useWalletAvailable } from "@/hooks/use-wallet";
import { api, errorMessage } from "@/lib/api";
import { depositUri } from "@/lib/payment-uri";
import { payWithEvm } from "@/lib/wallets/evm";
import { payWithSolana } from "@/lib/wallets/solana";
import { OrDivider, StepHeader } from "@/components/app/checkout/utils";

const POLL_MS = 4000;
/** How long we tell payers a swap usually takes, from deposit to delivery. */
const TYPICAL_MS = 15 * 60_000;

export function DepositStep({
  invoice,
  swap,
  onUpdate,
  onReset,
}: {
  invoice: PublicInvoiceDTO;
  swap: SwapDTO;
  onUpdate: (swap: SwapDTO, invoiceStatus?: InvoiceStatus) => void;
  onReset: () => void;
}) {
  const toast = useToast();
  const { tokens } = useTokens();
  const token = tokens?.find((t) => t.assetId === swap.originAsset);
  const meta = chainMeta(swap.originChain);
  const [payState, setPayState] = useState<ButtonState>("idle");
  const [txHash, setTxHash] = useState("");
  const walletAvailable = useWalletAvailable(meta.wallet);
  const now = useNow();

  const terminal = ["SUCCESS", "REFUNDED", "FAILED", "EXPIRED"].includes(swap.status);
  const onPolled = useEffectEvent((next: SwapDTO, invoiceStatus: InvoiceStatus) => onUpdate(next, invoiceStatus));

  useEffect(() => {
    if (terminal) return;
    const id = window.setInterval(async () => {
      try {
        const res = await api<{ swap: SwapDTO; invoiceStatus: InvoiceStatus }>(`/public/invoices/${invoice.id}/payments/${swap.id}`);
        onPolled(res.swap, res.invoiceStatus);
      } catch {
        // Transient; keep polling.
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [invoice.id, swap.id, terminal]);

  const uri = useMemo(() => depositUri(token, swap.depositAddress, swap.amountIn, swap.amountInFormatted), [token, swap]);

  const submitHash = async (hash: string) => {
    try {
      const next = await api<SwapDTO>(`/public/invoices/${invoice.id}/payments/${swap.id}/deposit-tx`, { body: { txHash: hash } });
      onUpdate(next);
    } catch {
      // Optional speed-up only; the deposit is detected on-chain regardless.
    }
  };

  const payWithWallet = async () => {
    setPayState("loading");
    try {
      const amount = BigInt(swap.amountIn);
      const hash =
        meta.wallet === "evm" && meta.evmChainId
          ? await payWithEvm({ chainId: meta.evmChainId, to: swap.depositAddress, amount, tokenAddress: token?.contractAddress })
          : await payWithSolana({ to: swap.depositAddress, amount, mint: token?.contractAddress, decimals: swap.originDecimals });
      setPayState("success");
      toast.success("Transaction sent", "Waiting for it to confirm on-chain.");
      await submitHash(hash);
    } catch (err) {
      setPayState("error");
      toast.error("Payment not sent", errorMessage(err));
      window.setTimeout(() => setPayState("idle"), 1500);
    }
  };

  const expired = swap.status === "PENDING_DEPOSIT" && new Date(swap.deadline).getTime() < now;

  const pending = swap.status === "PENDING_DEPOSIT" && !expired;
  const awaitingFunds = swap.status === "PENDING_DEPOSIT" || swap.status === "INCOMPLETE_DEPOSIT";
  const swapping = swap.status === "KNOWN_DEPOSIT_TX" || swap.status === "PROCESSING";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        {swap.status === "PENDING_DEPOSIT" ? (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Change token
          </button>
        ) : (
          <span />
        )}
        {pending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> <Countdown to={swap.deadline} className="font-medium text-foreground tabular" />
          </span>
        ) : null}
      </div>

      <StepHeader
        icon={awaitingFunds ? <ArrowDownToLine className="size-6" /> : <Loader variant="spinner" size={22} />}
        title={awaitingFunds ? "Complete your payment" : "Payment on its way"}
        body={
          awaitingFunds
            ? `Send exactly this amount on ${meta.name}. We'll detect it automatically.`
            : `We've got your ${swap.originSymbol}. It's being swapped and delivered privately to ${invoice.creatorName}.`
        }
      />

      {swapping ? <SwappingNotice swap={swap} now={now} creatorName={invoice.creatorName} chainName={meta.name} /> : null}

      {awaitingFunds ? (
        <>
          <div className="mt-8 rounded-3xl border border-border bg-white p-5 shadow-[0_3px_0_0_#eeedf5]">
            <div className="flex items-center gap-3">
              <TokenIcon symbol={swap.originSymbol} chain={swap.originChain} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Amount to send</p>
                <p className="truncate text-2xl font-semibold tracking-tight tabular">
                  {swap.amountInFormatted} {swap.originSymbol}
                </p>
              </div>
              <CopyButton value={swap.amountInFormatted} label="Copy amount" text="Copy" showLabel />
            </div>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              On <span className="font-medium text-foreground">{meta.name}</span>
              {swap.amountInUsd ? ` · ≈ ${formatUsd(swap.amountInUsd)}` : ""} · excess is refunded
            </p>
          </div>

          {swap.status === "INCOMPLETE_DEPOSIT" ? (
            <p className="mt-4 flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="size-4 shrink-0" />
              We received less than the quoted amount. Send the difference to the same address before the timer ends, or it will be refunded to you.
            </p>
          ) : null}

          {walletAvailable && pending ? (
            <>
              <button type="button" onClick={payWithWallet} disabled={payState === "loading"} className="btn-solid mt-5 h-14 w-full text-[15px] font-semibold">
                {payState === "loading" ? (
                  <>
                    <Loader variant="spinner" size={16} /> Confirm in your wallet
                  </>
                ) : payState === "success" ? (
                  <>
                    <Check className="size-4" /> Sent
                  </>
                ) : (
                  <>
                    <Wallet className="size-4" /> Pay with wallet
                  </>
                )}
              </button>
              <div className="my-5">
                <OrDivider>or send manually</OrDivider>
              </div>
            </>
          ) : (
            <div className="h-5" />
          )}

          <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-[#fafafe] p-4 sm:flex-row sm:items-start">
            <QrCode value={uri} size={128} className="shrink-0" />
            <div className="w-full min-w-0 flex-1 space-y-2">
              <CopyField label={`${meta.name} deposit address`} value={swap.depositAddress} className="bg-white" />
              {swap.depositMemo ? <CopyField label="Memo (required)" value={swap.depositMemo} className="border-amber-500/40 bg-amber-50" /> : null}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Send only {swap.originSymbol} on {meta.name} to this one-time address{swap.depositMemo ? ", and include the memo" : ""}. Anything else may be lost.
          </p>

          {pending ? (
            <details className="group mt-4 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground select-none hover:text-foreground">
                <ChevronRight className="size-4 transition-transform group-open:rotate-90" /> Sent from an exchange? Add the transaction hash
              </summary>
              <div className="mt-3 flex gap-2">
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value.trim())}
                  placeholder="Transaction hash (optional)"
                  className={`${fieldClass} min-w-0 flex-1 px-3 font-mono text-xs`}
                />
                <button
                  type="button"
                  disabled={txHash.length < 8}
                  onClick={() => submitHash(txHash).then(() => toast.success("Thanks, we're watching for it"))}
                  className="btn-soft h-12 rounded-2xl px-4 text-sm font-medium"
                >
                  Submit
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Optional. Deposits are detected automatically; this just speeds things up.</p>
            </details>
          ) : null}
        </>
      ) : null}

      {expired ? (
        <div className="mt-6 rounded-3xl border border-border bg-[#fafafe] p-5 text-sm">
          <p className="font-semibold">This quote expired</p>
          <p className="mt-1 text-muted-foreground">If you already sent funds, they&apos;ll be refunded to your address. Otherwise, get a fresh quote.</p>
          <button type="button" onClick={onReset} className="btn-solid mt-4 h-11 px-5 text-sm font-semibold">
            Get a new quote
          </button>
        </div>
      ) : null}

      {swap.status === "REFUNDED" || swap.status === "FAILED" ? (
        <div className="mt-6 rounded-3xl border border-border bg-[#fafafe] p-5 text-sm">
          <p className="font-semibold">{swap.status === "REFUNDED" ? "Your payment was refunded" : "The swap failed"}</p>
          <p className="mt-1 text-muted-foreground">
            {swap.refundedAmountFormatted
              ? `${formatAmount(swap.refundedAmountFormatted, 6)} ${swap.originSymbol} went back to your refund address.`
              : "Any funds received are returned to your refund address."}
          </p>
          <button type="button" onClick={onReset} className="btn-solid mt-4 h-11 px-5 text-sm font-semibold">
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-8 rounded-3xl border border-border bg-white p-5">
        <SwapTracker
          status={swap.status}
          labels={["Waiting for your payment", "Payment detected", "Swapping to ZEC", `Delivered privately to ${invoice.creatorName}`]}
        />
        {swap.originTxs[0] ? (
          <a
            href={swap.originTxs[0].explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View your transaction <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** While the swap runs: a countdown against the usual 15 minutes, and reassurance that the payer can leave. */
function SwappingNotice({ swap, now, creatorName, chainName }: { swap: SwapDTO; now: number; creatorName: string; chainName: string }) {
  // Starts when the deposit was detected; payments from before that was recorded start when this page saw them.
  const [seenAt] = useState(() => Date.now());
  const start = swap.detectedAt ? new Date(swap.detectedAt).getTime() : seenAt;
  const elapsed = Math.max(0, now - start);
  const left = TYPICAL_MS - elapsed;
  const late = left <= 0;
  const pct = Math.min(100, (elapsed / TYPICAL_MS) * 100);

  return (
    <>
      <div className="mt-8 rounded-3xl border border-border bg-white p-5 shadow-[0_3px_0_0_#eeedf5]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{late ? "Taking a little longer than usual" : "Estimated time left"}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatDuration(late ? elapsed : left)}</p>
          </div>
          <span className="pb-1 text-xs text-muted-foreground">{late ? "elapsed" : "of 15:00"}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Estimated swap progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={late ? "h-full rounded-full bg-amber-400" : "h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {late
            ? `Nothing to do on your side. It will complete, or be refunded to your ${chainName} address automatically.`
            : "Most payments finish in a few minutes. We allow up to 15."}
        </p>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-primary/15 bg-[#f6f5fe] p-4 text-sm">
        <DoorOpen className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">You can close this tab</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Your payment is on its way and {creatorName} receives it even if you leave. If anything goes wrong, it&apos;s refunded to your {chainName} address
            automatically. Open this link again anytime to check.
          </p>
        </div>
      </div>
    </>
  );
}
