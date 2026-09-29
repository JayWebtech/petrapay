"use client";

import { ZEC_ASSET_ID, chainMeta, formatAmount, formatUsd, type AddressDTO, type QuotePreviewDTO, type SwapDTO, type TokenDTO } from "@petrapay/shared";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/dash/ui";
import { FieldHint, FieldLabel, TextField, fieldClass } from "@/components/app/field";
import { useToast } from "@/components/app/toaster";
import { TokenIcon } from "@/components/app/token-icon";
import { TokenSelector } from "@/components/app/token-selector";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { useTokens } from "@/hooks/use-tokens";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function WithdrawPage() {
  const toast = useToast();
  const router = useRouter();
  const { tokens } = useTokens();
  const addresses = useApi<AddressDTO[]>("/addresses");

  const [token, setToken] = useState<TokenDTO | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  // Refunds go back to your default shielded address unless you change it.
  const [refundDraft, setRefundDraft] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ key: string; preview?: QuotePreviewDTO; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const zec = tokens?.find((t) => t.assetId === ZEC_ASSET_ID);
  const defaultRefund = (addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0])?.address ?? "";
  const refundTo = refundDraft ?? defaultRefund;
  const chainName = token ? chainMeta(token.blockchain).name : null;

  const ready = !!token && Number(amount) > 0 && recipient.trim().length > 3 && refundTo.length > 10;
  const quoteKey = ready ? [token.assetId, amount, recipient.trim(), refundTo].join("|") : null;

  // Debounced dry quote whenever inputs change. Results are tagged with the inputs they belong to.
  useEffect(() => {
    if (!quoteKey || !token) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const q = await api<QuotePreviewDTO>("/withdrawals/quote", {
          body: { destinationAsset: token.assetId, recipient: recipient.trim(), amountZec: amount, refundTo, dry: true },
          signal: ctrl.signal,
        });
        setQuote({ key: quoteKey, preview: q });
      } catch (err) {
        if (!ctrl.signal.aborted) setQuote({ key: quoteKey, error: errorMessage(err) });
      }
    }, 450);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [quoteKey, token, amount, recipient, refundTo]);

  const currentQuote = quote && quote.key === quoteKey ? quote : null;
  const preview = currentQuote?.preview ?? null;
  const previewError = currentQuote?.error ?? null;
  const previewing = !!quoteKey && !currentQuote;

  const create = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const swap = await api<SwapDTO>("/withdrawals/quote", {
        body: { destinationAsset: token.assetId, recipient: recipient.trim(), amountZec: amount, refundTo, dry: false },
      });
      router.push(`/dashboard/withdrawals/${swap.id}`);
    } catch (err) {
      toast.error("Couldn't create withdrawal", errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link href="/dashboard/withdrawals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Withdrawals
      </Link>
      <PageHeader title="New withdrawal" description="Swap ZEC from your own wallet to any token on any supported chain. PetraPay never holds funds." />

      <div className="max-w-xl space-y-6 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(17,15,36,0.04)] sm:p-6">
        <div>
          <FieldLabel htmlFor="amount">You send</FieldLabel>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-[0_2px_0_0_#eeedf5] transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
            <div className="flex items-center gap-3">
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight outline-none tabular placeholder:text-muted-foreground/40"
              />
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium">
                <TokenIcon symbol="ZEC" chain="zec" size={20} /> ZEC
              </span>
            </div>
            <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground tabular">
              <span>{zec && Number(amount) > 0 ? `≈ ${formatUsd(Number(amount) * zec.priceUsd)}` : "Amount in ZEC"}</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3 text-primary" /> from your shielded wallet
              </span>
            </p>
          </div>
        </div>

        <div className="-my-3 flex justify-center">
          <span className="grid size-8 place-items-center rounded-full border border-border bg-white text-muted-foreground">
            <ArrowDown className="size-4" />
          </span>
        </div>

        <div>
          <FieldLabel>You receive</FieldLabel>
          <button
            type="button"
            disabled={!tokens}
            onClick={() => setSelectorOpen(true)}
            className={cn(fieldClass, "flex h-14 items-center justify-between text-left hover:border-[#d6d3e6]")}
          >
            {token ? (
              <span className="flex items-center gap-3">
                <TokenIcon symbol={token.symbol} chain={token.blockchain} size={30} />
                <span>
                  <span className="block text-[15px] font-semibold">{token.symbol}</span>
                  <span className="block text-xs text-muted-foreground">on {chainName}</span>
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground/70">{tokens ? "Choose a token and chain" : "Loading tokens…"}</span>
            )}
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          <TokenSelector
            open={selectorOpen}
            onClose={() => setSelectorOpen(false)}
            tokens={tokens ?? []}
            exclude={[ZEC_ASSET_ID]}
            selectedId={token?.assetId}
            onSelect={setToken}
            title="You receive"
            estimate={(t) => {
              const zats = Number(amount);
              if (!zec || !(zats > 0) || !(t.priceUsd > 0)) return null;
              const n = (zats * zec.priceUsd) / t.priceUsd;
              return `≈ ${n.toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 2 : 6 })} ${t.symbol}`;
            }}
          />
        </div>

        <TextField
          label="Recipient address"
          mono
          placeholder={token ? chainMeta(token.blockchain).addressHint : "Choose a token first"}
          value={recipient}
          onChange={(v) => setRecipient(v.trim())}
          disabled={!token}
          spellCheck={false}
          autoComplete="off"
          hint={token ? `The ${chainName} address that receives the ${token.symbol}. Double-check it: transfers can't be reversed.` : undefined}
        />

        <div>
          <FieldLabel
            htmlFor="refund"
            action={
              refundDraft !== null && refundDraft !== defaultRefund && defaultRefund ? (
                <button type="button" onClick={() => setRefundDraft(null)} className="text-xs font-medium text-primary hover:underline">
                  Reset to default
                </button>
              ) : null
            }
          >
            Refund address
          </FieldLabel>
          <input
            id="refund"
            value={refundTo}
            onChange={(e) => setRefundDraft(e.target.value.trim())}
            spellCheck={false}
            autoComplete="off"
            placeholder="u1… shielded address"
            className={cn(fieldClass, "font-mono text-sm")}
          />
          <FieldHint>If the swap can&apos;t complete, your ZEC comes back here. Defaults to your default shielded address.</FieldHint>
        </div>

        <div className="rounded-2xl border border-border bg-[#fafafe] p-4 text-sm">
          {previewing ? (
            <div className="space-y-2.5" role="status" aria-label="Fetching quote">
              <div className="flex justify-between">
                <span className="h-3 w-20 animate-pulse rounded-full bg-muted" />
                <span className="h-4 w-32 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="flex justify-between">
                <span className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                <span className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="flex justify-between">
                <span className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                <span className="h-3 w-14 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          ) : previewError ? (
            <p className="text-destructive">{previewError}</p>
          ) : preview && token ? (
            <div className="space-y-2">
              <Row label="You receive" value={`${formatAmount(preview.amountOutFormatted, 6)} ${token.symbol}`} strong />
              <Row label="Value" value={formatUsd(preview.amountOutUsd)} />
              <Row label="Estimated time" value={`~${Math.max(1, Math.round(preview.timeEstimate / 60))} min`} />
            </div>
          ) : (
            <p className="text-muted-foreground">Enter an amount, a token and a recipient to see a live quote.</p>
          )}
        </div>

        <button type="button" onClick={create} disabled={!preview || submitting} className="btn-solid h-12 w-full text-[15px] font-semibold">
          {submitting ? (
            <>
              <Loader variant="spinner" size={16} /> Getting deposit address
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold tabular" : "tabular"}>{value}</span>
    </div>
  );
}
