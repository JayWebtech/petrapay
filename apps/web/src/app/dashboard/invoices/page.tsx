"use client";

import type { InvoiceDTO, InvoiceStatus } from "@petrapay/shared";
import { Plus, Search } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InvoiceTable } from "@/components/app/dash/invoice-table";
import { PageHeader, Panel } from "@/components/app/dash/ui";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const FILTERS: { value: "all" | InvoiceStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function InvoicesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [query, setQuery] = useState("");
  const { data, error } = useApi<InvoiceDTO[]>("/invoices", { pollMs: 15_000 });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const inv of data ?? []) c[inv.status] = (c[inv.status] ?? 0) + 1;
    return c;
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return data
      .filter((inv) => filter === "all" || inv.status === filter)
      .filter((inv) => !q || inv.title.toLowerCase().includes(q) || String(inv.number).padStart(3, "0").includes(q) || inv.id.toLowerCase() === q);
  }, [data, filter, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Each invoice settles to its own shielded address."
        actions={
          <Link href="/dashboard/invoices/new" className="btn-solid h-10 rounded-xl px-4 text-sm font-semibold">
            <Plus className="size-4" /> Create invoice
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
                "relative flex min-w-[120px] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                active ? "border-primary/60 bg-white" : "border-border bg-white hover:border-[#d6d3e6]",
              )}
            >
              {active ? <motion.span layoutId="invoice-filter" className="absolute inset-0 rounded-xl ring-2 ring-primary/15" /> : null}
              <span className={cn("text-xs", active ? "font-medium text-primary" : "text-muted-foreground")}>{f.label}</span>
              <span className="text-lg font-semibold tabular">{data ? (counts[f.value] ?? 0) : "–"}</span>
            </button>
          );
        })}
      </div>

      <Panel>
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-border px-2.5 text-sm focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or number"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{rows ? `${rows.length} result${rows.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        {error && !data ? (
          <p className="px-5 py-12 text-center text-sm text-destructive">{error}</p>
        ) : rows && rows.length === 0 && data && data.length > 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No invoices match this filter.</p>
        ) : (
          <InvoiceTable invoices={rows} />
        )}
      </Panel>
    </div>
  );
}
