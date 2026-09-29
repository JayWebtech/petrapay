"use client";

import { chainMeta, formatAmount, shortAddress, type SwapDTO } from "@petrapay/shared";
import { ArrowUpRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader, Panel, SwapPill } from "@/components/app/dash/ui";
import { TokenIcon } from "@/components/app/token-icon";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const IN_FLIGHT = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"];
const FILTERS = [
  { value: "all", label: "All", match: () => true },
  { value: "active", label: "In progress", match: (w: SwapDTO) => IN_FLIGHT.includes(w.status) },
  { value: "done", label: "Delivered", match: (w: SwapDTO) => w.status === "SUCCESS" },
  { value: "closed", label: "Refunded or expired", match: (w: SwapDTO) => ["REFUNDED", "FAILED", "EXPIRED"].includes(w.status) },
] as const;

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function WithdrawalsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const { data, error } = useApi<SwapDTO[]>("/withdrawals", { pollMs: 10_000 });

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, data?.filter(f.match).length ?? 0])), [data]);
  const rows = useMemo(() => data?.filter(FILTERS.find((f) => f.value === filter)!.match) ?? null, [data, filter]);
  const totalZec = useMemo(() => (data ?? []).filter((w) => w.status === "SUCCESS").reduce((sum, w) => sum + Number(w.amountInFormatted), 0), [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        description={data ? `${formatAmount(totalZec, 4)} ZEC cashed out to date. Every withdrawal is sent from your own wallet.` : "Cash out ZEC to any token on any chain."}
        actions={
          <Link href="/dashboard/withdraw" className="btn-solid h-10 rounded-xl px-4 text-sm font-semibold">
            <Plus className="size-4" /> New withdrawal
          </Link>
        }
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "relative flex min-w-[130px] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                active ? "border-primary/60 bg-white" : "border-border bg-white hover:border-[#d6d3e6]",
              )}
            >
              {active ? <motion.span layoutId="withdrawal-filter" className="absolute inset-0 rounded-xl ring-2 ring-primary/15" /> : null}
              <span className={cn("text-xs", active ? "font-medium text-primary" : "text-muted-foreground")}>{f.label}</span>
              <span className="text-lg font-semibold tabular">{data ? counts[f.value] : "–"}</span>
            </button>
          );
        })}
      </div>

      <Panel>
        {error && !data ? (
          <p className="px-5 py-12 text-center text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-6 px-5 py-4">
                <span className="h-4 w-24 animate-pulse rounded bg-muted" />
                <span className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="icon-tile size-12">
              <ArrowUpRight className="size-5 text-muted-foreground" />
            </span>
            <p className="mt-4 text-sm font-semibold">{data && data.length > 0 ? "Nothing matches this filter" : "No withdrawals yet"}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Swap ZEC to USDC, SOL, ETH or 100+ other tokens, delivered on the chain you choose.</p>
            {data && data.length === 0 ? (
              <Link href="/dashboard/withdraw" className="btn-solid mt-5 h-10 rounded-xl px-4 text-sm font-semibold">
                <Plus className="size-4" /> New withdrawal
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-3 pl-5 font-medium">Sent</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Received</th>
                  <th className="px-3 py-2.5 font-medium">Recipient</th>
                  <th className="py-2.5 pr-5 pl-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((w) => (
                  <tr key={w.id} onClick={() => router.push(`/dashboard/withdrawals/${w.id}`)} className="cursor-pointer transition-colors hover:bg-[#fafafe]">
                    <td className="py-3.5 pr-3 pl-5 whitespace-nowrap tabular">
                      <Link href={`/dashboard/withdrawals/${w.id}`} onClick={(e) => e.stopPropagation()} className="outline-none focus-visible:underline">
                        <span className="font-semibold">{formatAmount(w.amountInFormatted, 6)}</span> <span className="text-xs text-muted-foreground">ZEC</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <SwapPill status={w.status} />
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <TokenIcon symbol={w.destinationSymbol} chain={w.destinationChain} size={24} />
                        <span className="whitespace-nowrap tabular">
                          {formatAmount(w.amountOutFormatted, 6)} {w.destinationSymbol}
                          <span className="block text-xs text-muted-foreground">{chainMeta(w.destinationChain).name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-muted-foreground">{shortAddress(w.recipient, 8, 6)}</td>
                    <td className="py-3.5 pr-5 pl-3 whitespace-nowrap text-muted-foreground">{when(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
