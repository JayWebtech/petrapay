"use client";

import { formatAmount, formatUsd, type InvoiceDTO, type LinkFieldType, type PaymentLinkDTO, type PaymentLinkDetailDTO } from "@petrapay/shared";
import { ArrowLeft, ChevronRight, ExternalLink, Link2, Lock, Pause, Play } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { Panel, Pill } from "@/components/app/dash/ui";
import { formatDate } from "@/components/app/invoice-row";
import { linkUrl, money, priceLabel } from "@/components/app/links/format";
import { ResponsesSummary } from "@/components/app/links/responses";
import { UnlockWithPhrase } from "@/components/app/links/unlock-box";
import { QrCode } from "@/components/app/qr";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { useDeviceBoxKey } from "@/hooks/use-responses";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<LinkFieldType, string> = { text: "Short text", email: "Email", phone: "Phone", textarea: "Long text", select: "Dropdown" };

const FILTERS = [
  { value: "paid", label: "Paid", match: (p: InvoiceDTO) => p.status === "PAID" || p.status === "PROCESSING" },
  { value: "all", label: "All checkouts", match: () => true },
] as const;

/** A link payment's state, from the creator's side. OPEN means a checkout was started but nothing has arrived. */
function PaymentPill({ status }: { status: InvoiceDTO["status"] }) {
  if (status === "PAID") return <Pill tone="success">Paid</Pill>;
  if (status === "PROCESSING") return <Pill tone="progress">Processing</Pill>;
  if (status === "CANCELLED") return <Pill tone="neutral">Cancelled</Pill>;
  if (status === "EXPIRED") return <Pill tone="neutral">Expired</Pill>;
  return <Pill tone="info">Not paid yet</Pill>;
}

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const announced = useRef(false);
  const deviceBox = useDeviceBoxKey();
  const { data: link, error, setData } = useApi<PaymentLinkDetailDTO>(`/links/${id}`, { pollMs: 10_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("paid");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.get("created") || announced.current) return;
    announced.current = true;
    toast.success("Payment link created", "Copy it and share it anywhere.");
    router.replace(`/dashboard/links/${id}`, { scroll: false });
  }, [params, toast, router, id]);

  const rows = useMemo(() => link?.payments.filter(FILTERS.find((f) => f.value === filter)!.match) ?? [], [link, filter]);

  if (error && !link) return <p className="text-sm text-destructive">{error}</p>;
  if (!link) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader variant="dots" size={24} />
      </div>
    );
  }

  const url = linkUrl(link.id);
  const hasFields = link.fields.length > 0;
  const conversion = link.stats.started ? Math.round((link.stats.paid / link.stats.started) * 100) : null;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await api<PaymentLinkDTO>(`/links/${link.id}`, { method: "PATCH", body: { active: !link.active } });
      setData({ ...link, ...next });
      toast.success(
        next.active ? "Link activated" : "Link paused",
        next.active ? "It's accepting payments again." : "Payers will see that it's paused.",
      );
    } catch (err) {
      toast.error("Couldn't update link", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/links"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Payment links
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="size-4" /> Payment link · created {formatDate(link.createdAt, { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] leading-none font-semibold tracking-[-0.03em]">{link.title}</h1>
            {link.active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Paused</Pill>}
          </div>
          <p className="mt-2 text-[15px] text-foreground/80 tabular">{priceLabel(link)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            value={url}
            label="Copy payment link"
            text="Copy link"
            showLabel
            className="btn-soft h-9 rounded-xl px-3 text-sm text-foreground"
          />
          <Link href={`/l/${link.id}`} target="_blank" className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
            Open <ExternalLink className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={cn(
              "h-9 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50",
              link.active ? "text-destructive hover:bg-[#fdecec]" : "btn-soft",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {link.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {link.active ? "Pause link" : "Activate"}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Payments"
          value={String(link.stats.paid)}
          sub={link.stats.started ? `${link.stats.started} checkouts started` : "No checkouts yet"}
        />
        <Stat
          label="Received"
          value={
            <>
              {formatAmount(link.stats.receivedZec, 4)} <span className="text-sm font-medium text-muted-foreground">ZEC</span>
            </>
          }
          sub={`${formatUsd(link.stats.receivedUsd)} at settlement`}
          icon={<Lock className="size-3.5 text-primary" />}
        />
        <Stat label="Conversion" value={conversion === null ? "—" : `${conversion}%`} sub="Of started checkouts, paid" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {hasFields && deviceBox === null ? (
            <UnlockWithPhrase
              title="Unlock payer answers on this device"
              body="Answers are encrypted to your account key. Enter your recovery phrase once on this device to read them."
            />
          ) : null}

          <Panel
            title="Payments"
            action={
              <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === f.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {filter === f.value ? (
                      <motion.span layoutId="link-payments-filter" className="absolute inset-0 rounded-md bg-white shadow-sm" />
                    ) : null}
                    <span className="relative">{f.label}</span>
                  </button>
                ))}
              </div>
            }
          >
            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">{link.payments.length ? "No paid checkouts yet" : "No payments yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {link.payments.length
                    ? "Checkouts that were started but not paid are under All checkouts."
                    : "Share your link to get paid. Each payment shows up here."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2.5 pr-3 pl-5 font-medium">Amount</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      {hasFields ? <th className="px-3 py-2.5 font-medium">Answers</th> : null}
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="py-2.5 pr-5 pl-3">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/dashboard/invoices/${p.id}`)}
                        className="cursor-pointer transition-colors hover:bg-[#fafafe]"
                      >
                        <td className="py-3.5 pr-3 pl-5 whitespace-nowrap tabular">
                          <Link
                            href={`/dashboard/invoices/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold outline-none focus-visible:underline"
                          >
                            {money(p.currency, p.amount)}
                          </Link>
                          {p.receivedZec ? (
                            <span className="block text-xs text-muted-foreground">{formatAmount(p.receivedZec, 4)} ZEC received</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3.5">
                          <PaymentPill status={p.status} />
                        </td>
                        {hasFields ? (
                          <td className="px-3 py-3.5">
                            <ResponsesSummary sealed={p.responses} />
                          </td>
                        ) : null}
                        <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">
                          {formatDate(p.paidAt ?? p.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="py-3.5 pr-5 pl-3 text-right text-muted-foreground">
                          <ChevronRight className="ml-auto size-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Share">
            <div className="p-5">
              <div className="flex justify-center rounded-2xl bg-[#fafafe] p-4">
                <QrCode value={url} size={160} />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border py-1.5 pr-1.5 pl-3">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{url.replace(/^https?:\/\//, "")}</span>
                <CopyButton value={url} label="Copy link" showLabel />
              </div>
            </div>
          </Panel>

          <Panel title="Details">
            <dl className="space-y-3.5 px-5 py-4 text-sm">
              <Detail label="Pricing">{link.amountType === "FIXED" ? "Fixed price" : "Customer chooses"}</Detail>
              <Detail label="Currency">{link.currency}</Detail>
              {link.presets.length ? <Detail label="Suggested">{link.presets.map((p) => money(link.currency, p)).join(", ")}</Detail> : null}
              {link.description ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Description</dt>
                  <dd className="mt-1 text-sm whitespace-pre-line text-foreground/80">{link.description}</dd>
                </div>
              ) : null}
            </dl>
            {hasFields ? (
              <div className="border-t border-border px-5 py-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3 text-primary" /> Collected, end-to-end encrypted
                </p>
                <ul className="mt-2.5 space-y-2">
                  {link.fields.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{f.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {TYPE_LABEL[f.type]}
                        {f.required ? "" : " · optional"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(17,15,36,0.04)]">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
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
