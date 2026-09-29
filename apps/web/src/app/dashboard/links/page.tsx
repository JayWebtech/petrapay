"use client";

import { formatAmount, formatUsd, type PaymentLinkDTO } from "@petrapay/shared";
import { HandCoins, Link2, ListChecks, Plus, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader, Panel, Pill } from "@/components/app/dash/ui";
import { linkUrl, priceLabel } from "@/components/app/links/format";
import { useApi } from "@/hooks/use-api";

const IDEAS = [
  { icon: Tag, title: "Sell something", body: "A fixed price for a product, file or service." },
  { icon: HandCoins, title: "Tips & donations", body: "Payers choose the amount, with suggestions." },
  { icon: ListChecks, title: "Collect details", body: "Ask for an email, size or shipping address." },
];

export default function LinksPage() {
  const router = useRouter();
  const { data, error } = useApi<PaymentLinkDTO[]>("/links", { pollMs: 20_000 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment links"
        description="One link, many payers. Share it anywhere; every payment settles to a fresh shielded address."
        actions={
          <Link href="/dashboard/links/new" className="btn-solid h-10 rounded-xl px-4 text-sm font-semibold">
            <Plus className="size-4" /> Create link
          </Link>
        }
      />

      <Panel>
        {error && !data ? (
          <p className="px-5 py-12 text-center text-sm text-destructive">{error}</p>
        ) : !data ? (
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-6 px-5 py-4">
                <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                <span className="h-4 w-20 animate-pulse rounded bg-muted" />
                <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="icon-tile size-12">
              <Link2 className="size-5 text-muted-foreground" />
            </span>
            <p className="mt-4 text-sm font-semibold">No payment links yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a link once and share it in your bio, a post or a DM. Anyone can pay it, in any token.
            </p>
            <div className="mt-6 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
              {IDEAS.map((idea) => (
                <div key={idea.title} className="rounded-xl border border-border p-4">
                  <idea.icon className="size-4 text-primary" />
                  <p className="mt-2 text-sm font-medium">{idea.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{idea.body}</p>
                </div>
              ))}
            </div>
            <Link href="/dashboard/links/new" className="btn-solid mt-6 h-10 rounded-xl px-4 text-sm font-semibold">
              <Plus className="size-4" /> Create link
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-3 pl-5 font-medium">Link</th>
                  <th className="px-3 py-2.5 font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Payments</th>
                  <th className="px-3 py-2.5 text-right font-medium">Received</th>
                  <th className="py-2.5 pr-5 pl-3">
                    <span className="sr-only">Copy</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/dashboard/links/${l.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-[#fafafe]"
                  >
                    <td className="py-3.5 pr-3 pl-5">
                      <Link
                        href={`/dashboard/links/${l.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium outline-none focus-visible:underline"
                      >
                        {l.title}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">/l/{l.id}</span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap tabular">{priceLabel(l)}</td>
                    <td className="px-3 py-3.5">{l.active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Paused</Pill>}</td>
                    <td className="px-3 py-3.5 text-right tabular">{l.stats.paid}</td>
                    <td className="px-3 py-3.5 text-right whitespace-nowrap tabular">
                      {l.stats.paid ? (
                        <>
                          {formatAmount(l.stats.receivedZec, 4)} <span className="text-xs text-muted-foreground">ZEC</span>
                          <span className="block text-xs text-muted-foreground">{formatUsd(l.stats.receivedUsd)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <CopyButton
                        value={linkUrl(l.id)}
                        label="Copy link"
                        className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      />
                    </td>
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
