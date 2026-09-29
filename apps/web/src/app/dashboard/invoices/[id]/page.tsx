"use client";

import { chainMeta, formatAmount, formatUsd, shortAddress, type InvoiceDTO } from "@petrapay/shared";
import { ArrowLeft, Check, ExternalLink, Eye, EyeOff, FileText, Link2, Lock, Mail, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { editBlocker } from "@/components/app/invoice-form";
import { formatDate, formatInvoiceAmount, payUrl } from "@/components/app/invoice-row";
import { ResponsesList } from "@/components/app/links/responses";
import { QrCode } from "@/components/app/qr";
import { InvoicePill, Panel, SwapPill } from "@/components/app/dash/ui";
import { useToast } from "@/components/app/toaster";
import { TokenIcon } from "@/components/app/token-icon";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { NoteText } from "@/hooks/use-note";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const announced = useRef(false);
  const {
    data: invoice,
    error,
    setData,
  } = useApi<InvoiceDTO>(`/invoices/${id}`, {
    pollMs: 6000,
    pollWhile: (inv) => !inv || inv.status === "OPEN" || inv.status === "PROCESSING",
  });
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<"cancel" | "paid" | null>(null);

  useEffect(() => {
    const created = params.get("created");
    if ((!created && !params.get("edited")) || announced.current) return;
    announced.current = true;
    if (created) toast.success("Invoice created", "Copy the link and send it to your client.");
    else toast.success("Invoice updated", "The payment page shows your changes. The link hasn't changed.");
    router.replace(`/dashboard/invoices/${id}`, { scroll: false });
  }, [params, toast, router, id]);

  if (error && !invoice) return <p className="text-sm text-destructive">{error}</p>;
  if (!invoice) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader variant="dots" size={24} />
      </div>
    );
  }

  const link = payUrl(invoice.id);
  const editable = !editBlocker(invoice);
  const number = String(invoice.number).padStart(3, "0");
  const mailto = invoice.clientEmail
    ? `mailto:${encodeURIComponent(invoice.clientEmail)}?${new URLSearchParams({
        subject: `Invoice #${number}: ${invoice.title}`,
        body: `Hi${invoice.clientName ? ` ${invoice.clientName}` : ""},\n\nHere's your invoice for ${invoice.title} (${formatInvoiceAmount(invoice)}). You can pay with any token:\n\n${link}\n\nThank you!`,
      })
        .toString()
        .replace(/\+/g, "%20")}`
    : null;
  const act = async (kind: "cancel" | "paid") => {
    setBusy(kind);
    try {
      const next = await api<InvoiceDTO>(`/invoices/${invoice.id}/${kind === "cancel" ? "cancel" : "mark-paid"}`, { method: "POST" });
      setData(next);
      toast.success(kind === "cancel" ? "Invoice cancelled" : "Marked as paid");
    } catch (err) {
      toast.error("Action failed", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  type Event = { at: string; title: string; detail?: string; tone: "done" | "info" | "warn" };
  const events: Event[] = [{ at: invoice.createdAt, title: invoice.link ? "Checkout started from payment link" : "Invoice created", tone: "info" }];
  for (const sw of invoice.swaps) {
    const how = `${formatAmount(sw.amountInFormatted, 6)} ${sw.originSymbol} on ${chainMeta(sw.originChain).name}`;
    events.push({ at: sw.createdAt, title: "Client started paying", detail: how, tone: "info" });
    if (sw.status === "SUCCESS" && sw.settledAt)
      events.push({
        at: sw.settledAt,
        title: "Payment settled, shielded",
        detail: `${formatAmount(sw.amountOutFormatted, 6)} ZEC delivered`,
        tone: "done",
      });
    if (sw.status === "REFUNDED") events.push({ at: sw.createdAt, title: "Payment refunded to client", detail: how, tone: "warn" });
    if (sw.status === "FAILED") events.push({ at: sw.createdAt, title: "Payment failed", detail: how, tone: "warn" });
  }
  if (invoice.editedAt) events.push({ at: invoice.editedAt, title: "Invoice edited", tone: "info" });
  if (invoice.payerMarkedPaidAt) events.push({ at: invoice.payerMarkedPaidAt, title: "Client reported a direct ZEC payment", tone: "info" });
  if (invoice.paidAt) events.push({ at: invoice.paidAt, title: "Invoice paid", tone: "done" });
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const when = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const amount = invoice.currency === "USD" ? formatUsd(invoice.amount) : formatAmount(invoice.amount, 8);

  return (
    <div className="space-y-8">
      <Link
        href={invoice.link ? `/dashboard/links/${invoice.link.id}` : "/dashboard/invoices"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {invoice.link ? invoice.link.title : "Invoices"}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {invoice.link ? (
              <>
                <Link2 className="size-4" /> Payment via{" "}
                <Link href={`/dashboard/links/${invoice.link.id}`} className="font-medium text-foreground/80 hover:underline">
                  {invoice.link.title}
                </Link>
              </>
            ) : (
              <>
                <FileText className="size-4" /> Invoice #{String(invoice.number).padStart(3, "0")}
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] leading-none font-semibold tracking-[-0.03em] tabular">
              {amount} <span className="text-lg font-medium text-muted-foreground">{invoice.currency}</span>
            </h1>
            <InvoicePill status={invoice.status} dueDate={invoice.dueDate} />
          </div>
          <p className="mt-2 truncate text-[15px] text-foreground/80">{invoice.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            value={link}
            label="Copy payment link"
            text="Copy link"
            showLabel
            className="btn-soft h-9 rounded-xl px-3 text-sm text-foreground"
          />
          {mailto ? (
            <a href={mailto} className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
              <Mail className="size-3.5" /> Email invoice
            </a>
          ) : null}
          <Link href={`/pay/${invoice.id}`} target="_blank" className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
            Open checkout <ExternalLink className="size-3.5" />
          </Link>
          {editable ? (
            <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
              <Pencil className="size-3.5" /> Edit
            </Link>
          ) : null}
          {invoice.status === "OPEN" ? (
            <>
              <button type="button" disabled={busy !== null} onClick={() => act("paid")} className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
                <Check className="size-3.5" /> Mark paid
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act("cancel")}
                className="h-9 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-[#fdecec] disabled:opacity-50"
              >
                Cancel invoice
              </button>
            </>
          ) : null}
        </div>
      </div>

      {invoice.payerMarkedPaidAt && invoice.status === "OPEN" ? (
        <div className="flex gap-3 rounded-2xl border border-primary/25 bg-[#f6f5fe] p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Your client says they paid in ZEC directly</p>
            <p className="mt-1 text-muted-foreground">
              Reported {when(invoice.payerMarkedPaidAt)}. Shielded payments are invisible to PetraPay, so check your wallet, then mark the invoice
              paid.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {invoice.link ? (
            <Panel
              title="Payer's answers"
              action={
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3 text-primary" /> End-to-end encrypted
                </span>
              }
            >
              <ResponsesList sealed={invoice.responses} />
            </Panel>
          ) : null}

          <Panel title="Activity">
            <ol className="px-5 py-4">
              {events.map((e, i) => (
                <li key={`${e.title}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < events.length - 1 ? <span className="absolute top-6 left-[11px] h-[calc(100%-16px)] w-px bg-border" /> : null}
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                      e.tone === "done"
                        ? "bg-[#e7f6ec] text-[#0e6b35]"
                        : e.tone === "warn"
                          ? "bg-[#fff1e6] text-[#9a3f00]"
                          : "bg-[#eeecfd] text-primary",
                    )}
                  >
                    {e.tone === "done" ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.detail ? `${e.detail} · ` : ""}
                      {when(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Line items">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-3 pl-5 font-medium">Description</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Unit price</th>
                  <th className="py-2.5 pr-5 pl-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lineItems.map((item, i) => {
                  const fmt = (n: number) => (invoice.currency === "USD" ? formatUsd(n) : `${formatAmount(n, 8)} ZEC`);
                  return (
                    <tr key={i}>
                      <td className="py-3 pr-3 pl-5">{item.description}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular">{fmt(Number(item.unitAmount))}</td>
                      <td className="py-3 pr-5 pl-3 text-right tabular">{fmt(Number(item.unitAmount) * item.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-3 pr-3 pl-5" colSpan={3}>
                    Total
                  </td>
                  <td className="py-3 pr-5 pl-3 text-right tabular">{formatInvoiceAmount(invoice)}</td>
                </tr>
              </tfoot>
            </table>
            {invoice.description ? (
              <p className="border-t border-border px-5 py-4 text-sm whitespace-pre-line text-muted-foreground">{invoice.description}</p>
            ) : null}
          </Panel>

          <Panel
            title="Payment attempts"
            action={<span className="hidden text-xs text-muted-foreground sm:block">One-time deposit address each</span>}
          >
            {invoice.swaps.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No one has started paying yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2.5 pr-3 pl-5 font-medium">Paid with</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Settles as</th>
                      <th className="px-3 py-2.5 font-medium">Started</th>
                      <th className="py-2.5 pr-5 pl-3">
                        <span className="sr-only">Transaction</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.swaps.map((sw) => (
                      <tr key={sw.id}>
                        <td className="py-3 pr-3 pl-5">
                          <span className="flex items-center gap-2.5">
                            <TokenIcon symbol={sw.originSymbol} chain={sw.originChain} size={26} />
                            <span className="tabular">
                              <span className="font-medium">
                                {formatAmount(sw.amountInFormatted, 6)} {sw.originSymbol}
                              </span>
                              <span className="block text-xs text-muted-foreground">{chainMeta(sw.originChain).name}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <SwapPill status={sw.status} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap tabular">{formatAmount(sw.amountOutFormatted, 6)} ZEC</td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(sw.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="py-3 pr-5 pl-3 text-right">
                          {sw.originTxs[0] ? (
                            <a
                              href={sw.originTxs[0].explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Tx <ExternalLink className="size-3" />
                            </a>
                          ) : null}
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
          <Panel title="Details">
            <dl className="space-y-3.5 px-5 py-4 text-sm">
              <Detail label="Billed to">
                {invoice.clientName || invoice.clientEmail ? (
                  <span className="block min-w-0">
                    {invoice.clientName ? <span className="block">{invoice.clientName}</span> : null}
                    {invoice.clientEmail ? (
                      <a href={`mailto:${invoice.clientEmail}`} className="block truncate text-xs text-primary hover:underline">
                        {invoice.clientEmail}
                      </a>
                    ) : null}
                  </span>
                ) : invoice.clientLabel ? (
                  <NoteText value={invoice.clientLabel} fallback="—" />
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label="Created">{formatDate(invoice.createdAt, { month: "short", day: "numeric", year: "numeric" })}</Detail>
              <Detail label="Due">{invoice.dueDate ? formatDate(invoice.dueDate, { month: "short", day: "numeric", year: "numeric" }) : "—"}</Detail>
              <Detail label="Received">
                {invoice.receivedZec ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5 text-primary" /> {formatAmount(invoice.receivedZec, 6)} ZEC
                  </span>
                ) : (
                  "—"
                )}
              </Detail>
              <div>
                <dt className="flex items-center justify-between text-xs text-muted-foreground">
                  Settles to
                  <button type="button" onClick={() => setRevealed((r) => !r)} className="inline-flex items-center gap-1 hover:text-foreground">
                    {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                </dt>
                <dd className="mt-1 font-mono text-xs break-all">
                  {revealed ? invoice.settlementAddress : shortAddress(invoice.settlementAddress, 10, 8)}
                </dd>
                <dd className="mt-1.5 text-xs text-muted-foreground">
                  {invoice.addressReused
                    ? "Reused your default address (pool was empty), so it can be linked to other invoices."
                    : "Single-use shielded address. No other invoice pays to it."}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Share">
            <div className="p-5">
              <div className="flex justify-center rounded-2xl bg-[#fafafe] p-4">
                <QrCode value={link} size={160} />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border py-1.5 pr-1.5 pl-3">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{link.replace(/^https?:\/\//, "")}</span>
                <CopyButton value={link} label="Copy link" showLabel />
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
