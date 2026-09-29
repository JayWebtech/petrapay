"use client";

import { chainMeta, formatAmount, formatUsd, shortAddress, zip321Uri, type SwapDTO } from "@petrapay/shared";
import { ArrowLeft, Clock, ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { CopyField } from "@/components/app/copy-button";
import { Countdown, useNow } from "@/components/app/countdown";
import { Panel, SwapPill } from "@/components/app/dash/ui";
import { QrCode } from "@/components/app/qr";
import { SwapTracker } from "@/components/app/swap-tracker";
import { useToast } from "@/components/app/toaster";
import { TokenIcon } from "@/components/app/token-icon";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";

const TERMINAL = ["SUCCESS", "REFUNDED", "FAILED", "EXPIRED"];
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function WithdrawalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: w, error } = useApi<SwapDTO>(`/withdrawals/${id}`, {
    pollMs: 5000,
    pollWhile: (s) => !s || !TERMINAL.includes(s.status),
  });

  // Celebrate delivery once, when it happens while the page is open.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!w) return;
    if (lastStatus.current && lastStatus.current !== "SUCCESS" && w.status === "SUCCESS") {
      toast.success(
        "Withdrawal delivered",
        `${formatAmount(w.amountOutFormatted, 6)} ${w.destinationSymbol} on ${chainMeta(w.destinationChain).name}`,
      );
    }
    lastStatus.current = w.status;
  }, [w, toast]);

  const uri = useMemo(
    () =>
      w
        ? zip321Uri({
            address: w.depositAddress,
            amountZats: BigInt(w.amountIn),
          })
        : "",
    [w],
  );
  const now = useNow();

  if (error && !w) return <p className="text-sm text-destructive">{error}</p>;
  if (!w) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader variant="dots" size={24} />
      </div>
    );
  }

  const chain = chainMeta(w.destinationChain).name;
  const awaiting = (w.status === "PENDING_DEPOSIT" && new Date(w.deadline).getTime() > now) || w.status === "INCOMPLETE_DEPOSIT";

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/withdrawals"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Withdrawals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Withdrawal · {when(w.createdAt)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] leading-none font-semibold tracking-[-0.03em] tabular">
              {formatAmount(w.amountInFormatted, 6)} <span className="text-lg font-medium text-muted-foreground">ZEC</span>
            </h1>
            <SwapPill status={w.status} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-[15px] text-foreground/80">
            <TokenIcon symbol={w.destinationSymbol} chain={w.destinationChain} size={20} />
            {formatAmount(w.amountOutFormatted, 6)} {w.destinationSymbol} on {chain}
            {w.amountOutUsd ? <span className="text-muted-foreground">· {formatUsd(w.amountOutUsd)}</span> : null}
          </p>
        </div>
        {w.status === "PENDING_DEPOSIT" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" /> Send within <Countdown to={w.deadline} className="font-medium text-foreground tabular" />
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {awaiting ? (
            <Panel title="Send ZEC from your wallet">
              <div className="@container">
                <div className="flex flex-col items-center gap-6 p-5 @xl:flex-row @xl:items-start">
                  <div className="rounded-2xl bg-[#fafafe] p-4">
                    <QrCode value={uri} size={176} center="ZEC" />
                  </div>
                  <div className="w-full min-w-0 flex-1 space-y-2.5">
                    <CopyField label="Amount" value={w.amountInFormatted} display={`${w.amountInFormatted} ZEC`} />
                    <CopyField label="Deposit address" value={w.depositAddress} />
                    <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                      Scan with Zashi, or copy both fields. If anything goes wrong, the ZEC is refunded to your shielded address.
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      This one-time bridge address is transparent, so the amount you send is public. Where it came from stays shielded.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel title="Progress">
            <div className="p-5">
              <SwapTracker status={w.status} labels={["Send ZEC from your wallet", "Deposit detected", "Swapping", `Delivered on ${chain}`]} />
              {w.status === "REFUNDED" && w.refundedAmountFormatted ? (
                <p className="mt-4 rounded-xl bg-[#fff1e6] p-3 text-sm text-[#9a3f00]">
                  {formatAmount(w.refundedAmountFormatted, 6)} ZEC was refunded to your shielded address.
                </p>
              ) : null}
              {w.status === "EXPIRED" ? (
                <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  This deposit address expired before any ZEC arrived. Start a new withdrawal to try again.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Details">
            <dl className="space-y-3.5 px-5 py-4 text-sm">
              <Detail label="You send">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" /> {formatAmount(w.amountInFormatted, 6)} ZEC
                </span>
              </Detail>
              <Detail label="You receive">
                {formatAmount(w.amountOutFormatted, 6)} {w.destinationSymbol}
              </Detail>
              <Detail label="Network">{chain}</Detail>
              <Detail label="Created">{when(w.createdAt)}</Detail>
              {w.settledAt ? <Detail label="Delivered">{when(w.settledAt)}</Detail> : null}
              <div>
                <dt className="text-xs text-muted-foreground">Recipient</dt>
                <dd className="mt-1 font-mono text-xs break-all">{w.recipient}</dd>
              </div>
            </dl>
          </Panel>

          {w.destinationTxs[0] || w.originTxs[0] ? (
            <Panel title="Transactions">
              <div className="space-y-2 p-5 text-sm">
                {w.originTxs[0] ? <TxLink label="ZEC deposit" href={w.originTxs[0].explorerUrl} hash={w.originTxs[0].hash} /> : null}
                {w.destinationTxs[0] ? (
                  <TxLink label={`Delivery on ${chain}`} href={w.destinationTxs[0].explorerUrl} hash={w.destinationTxs[0].hash} />
                ) : null}
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular">{children}</dd>
    </div>
  );
}

function TxLink({ label, href, hash }: { label: string; href: string; hash: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-[#fafafe]"
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{shortAddress(hash, 8, 6)}</span>
      </span>
      <ExternalLink className="size-4 text-muted-foreground" />
    </a>
  );
}
