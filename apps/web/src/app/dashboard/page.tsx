"use client";

import { chainMeta, formatAmount, formatUsd, type InvoiceDTO, type StatsDTO } from "@petrapay/shared";
import { ArrowRight, ArrowUpRight, Check, FileText, Lock, Plus, Shield, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { AreaChart, Sparkline } from "@/components/app/dash/charts";
import { InvoiceTable } from "@/components/app/dash/invoice-table";
import { PageHeader, Panel } from "@/components/app/dash/ui";
import { TokenIcon } from "@/components/app/token-icon";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
];

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const { me } = useAuth();
  const [range, setRange] = useState("30");
  const stats = useApi<StatsDTO>(`/stats?days=${range}`, { pollMs: 20_000, keepPrevious: true });
  const invoices = useApi<InvoiceDTO[]>("/invoices", { pollMs: 20_000 });

  if (!me) return null;
  const s = stats.data;
  const series = s?.series ?? [];
  const rangeZec = series.reduce((sum, p) => sum + Number(p.zec), 0);
  const rangeUsd = series.reduce((sum, p) => sum + Number(p.usd), 0);
  const rangeCount = series.reduce((sum, p) => sum + p.count, 0);
  const avgUsd = rangeCount ? rangeUsd / rangeCount : 0;
  // Running totals read better than spiky daily values when payments are sparse.
  const cumulative = (values: number[]) => values.reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + v], []);
  const cumZec = cumulative(series.map((p) => Number(p.zec)));
  const lifetimeZec = Number(s?.receivedZec ?? 0);

  const setup = [
    { done: !!me.displayName, label: "Name your studio", href: "/dashboard/settings", icon: User },
    { done: me.totalAddresses > 0, label: "Add shielded addresses", href: "/dashboard/addresses", icon: Shield },
    { done: (invoices.data?.length ?? 0) > 0, label: "Send your first invoice", href: "/dashboard/invoices/new", icon: FileText },
  ];
  const doneCount = setup.filter((x) => x.done).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}${me.displayName ? `, ${me.displayName}` : ""}`}
        description="Here's what's landed in your shielded wallet. Only you can see this."
        actions={
          <Tabs value={range} onValueChange={setRange} variant="segment">
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {invoices.data && doneCount < setup.length ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5">
            <div>
              <p className="text-sm font-semibold">Get set up to accept payments</p>
              <p className="text-xs text-muted-foreground">
                {doneCount} of {setup.length} complete
              </p>
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
          </div>
          <div className="mt-4 grid border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
            {setup.map((step) => (
              <Link key={step.label} href={step.href} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#fafafe]">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border",
                    step.done ? "border-transparent bg-[#e7f6ec] text-[#0e6b35]" : "border-border text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-3.5" strokeWidth={3} /> : <step.icon className="size-3.5" />}
                </span>
                <span className={cn("flex-1 text-sm", step.done ? "text-muted-foreground line-through" : "font-medium")}>{step.label}</span>
                {!step.done ? <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : null}
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <div className="px-5 pt-5">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-3.5 text-primary" /> Received · last {range} days
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <p className="text-[32px] font-semibold tracking-[-0.03em] tabular">
                {s ? <AnimatedNumber value={rangeZec} startOnView={false} format={(n) => n.toLocaleString("en-US", { maximumFractionDigits: 4 })} /> : "—"}
                <span className="ml-1.5 text-lg font-medium text-muted-foreground">ZEC</span>
              </p>
              <p className="text-sm text-muted-foreground tabular">
                {formatUsd(rangeUsd)} at settlement · {rangeCount} payment{rangeCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="px-3 pt-4 pb-3 sm:px-5">
            <AreaChart
              caption={`Cumulative ZEC received over the last ${range} days`}
              data={series.map((p, i) => ({ label: shortDate(p.date), value: cumZec[i] ?? 0 }))}
              formatValue={(n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} ZEC total`}
              formatDetail={(i) => {
                const p = series[i];
                return p && p.count ? `+${formatAmount(p.zec, 4)} ZEC from ${p.count} payment${p.count === 1 ? "" : "s"}` : null;
              }}
              dimmed={stats.stale}
            />
          </div>
        </Panel>

        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl bg-[#0f0c2e] p-5 text-white">
            <div aria-hidden="true" className="absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(106,76,255,0.55),transparent)]" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(245,222,176,0.18),transparent)]" />
            <p className="relative flex items-center gap-1.5 text-xs text-white/60">
              <Lock className="size-3 text-[#f5deb0]" /> Received to date, shielded
            </p>
            <p className="relative mt-2 text-3xl font-semibold tracking-tight text-[#f5deb0] tabular">
              {s ? lifetimeZec.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"} <span className="text-base text-white/60">ZEC</span>
            </p>
            <p className="relative text-xs text-white/55 tabular">
              {s?.zecPriceUsd ? `≈ ${formatUsd(lifetimeZec * s.zecPriceUsd)} today` : " "}
              {s && Number(s.withdrawnZec) > 0 ? ` · ${formatAmount(s.withdrawnZec, 4)} ZEC cashed out` : ""}
            </p>
            <div className="relative mt-5 flex gap-2">
              <Link href="/dashboard/withdraw" className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-sm font-medium text-[#110f24]">
                <ArrowUpRight className="size-4" /> Cash out
              </Link>
              <Link
                href="/dashboard/invoices/new"
                className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                <Plus className="size-4" /> Invoice
              </Link>
            </div>
            <p className="relative mt-4 text-[11px] leading-relaxed text-white/45">Held in your own Orchard wallet. PetraPay can&apos;t see or move it.</p>
          </div>

          <Panel>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Address pool</p>
                <Link href="/dashboard/addresses" className="text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular">
                {me.freshAddresses}
                <span className="text-sm font-normal text-muted-foreground"> fresh of {me.totalAddresses}</span>
              </p>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {me.totalAddresses === 0 ? (
                  <span className="flex-1 bg-muted" />
                ) : (
                  <>
                    <span className="bg-primary" style={{ flex: me.freshAddresses }} />
                    <span className="bg-[#dcd8f5]" style={{ flex: me.totalAddresses - me.freshAddresses }} />
                  </>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {me.totalAddresses === 0
                  ? "Add unified addresses from Zashi so invoices have somewhere to settle."
                  : me.freshAddresses < 3
                    ? "Running low. When it's empty, new invoices reuse your default address and can be linked."
                    : "Each new invoice takes a fresh address, so payments can't be linked."}
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Your overview</h2>
        <div className={cn("mt-4 grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4", stats.stale && "opacity-50")}>
          <Metric label="Paid invoices" value={s ? String(rangeCount) : "—"} hint={`Last ${range} days`} spark={cumulative(series.map((p) => p.count))} />
          <Metric label="Volume" value={s ? formatUsd(rangeUsd) : "—"} hint="USD value at settlement" spark={cumulative(series.map((p) => Number(p.usd)))} />
          <Metric label="Average invoice" value={s ? formatUsd(avgUsd) : "—"} hint={rangeCount ? `Across ${rangeCount} payments` : "No payments yet"} />
          <Metric
            label="Outstanding"
            value={s ? formatUsd(s.openAmountUsd) : "—"}
            hint={s ? `${s.openCount} open · ${s.processingCount} processing` : ""}
            href="/dashboard/invoices"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Recent invoices"
          action={
            <Link href="/dashboard/invoices" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          <InvoiceTable invoices={invoices.data?.slice(0, 6) ?? null} compact />
        </Panel>

        <Panel title="How clients pay">
          <div className="p-5">
            {!s || s.paidWith.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No payments yet. Once clients pay, you&apos;ll see which tokens and chains they use most.
              </p>
            ) : (
              <ul className="space-y-4">
                {s.paidWith.map((m) => {
                  const max = Number(s.paidWith[0]!.usd) || 1;
                  return (
                    <li key={`${m.symbol}-${m.chain}`}>
                      <div className="flex items-center gap-2.5 text-sm">
                        <TokenIcon symbol={m.symbol} chain={m.chain} size={24} />
                        <span className="flex-1 font-medium">
                          {m.symbol} <span className="font-normal text-muted-foreground">· {chainMeta(m.chain).name}</span>
                        </span>
                        <span className="tabular">{formatUsd(m.usd)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (Number(m.usd) / max) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {m.count} payment{m.count === 1 ? "" : "s"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, spark, href }: { label: string; value: string; hint: string; spark?: number[]; href?: string }) {
  const body = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5">
      <p className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {href ? <ArrowRight className="size-3.5" /> : null}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {spark ? (
        <div className="mt-auto pt-4">
          <Sparkline values={spark} />
        </div>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
