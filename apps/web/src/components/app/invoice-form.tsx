"use client";

import { createInvoiceSchema, formatAmount, formatUsd, type InvoiceDTO, type UpdateInvoiceInput } from "@petrapay/shared";
import { Lock, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { PageHeader } from "@/components/app/dash/ui";
import { FieldLabel, TextField, fieldClass, textareaClass } from "@/components/app/field";
import { useToast } from "@/components/app/toaster";
import { StatefulButton, type ButtonState } from "@/components/motion/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Line = { key: number; description: string; quantity: string; unitAmount: string };

let lineKey = 1;
const newLine = (l: Partial<Omit<Line, "key">> = {}): Line => ({ key: lineKey++, description: "", quantity: "1", unitAmount: "", ...l });

/** yyyy-mm-dd in local time, for <input type="date">. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Why the total can't change right now, if it can't: a client is holding a quote for it,
 * or said they already paid it in ZEC.
 */
export function priceLock(invoice: InvoiceDTO, now = Date.now()): string | null {
  const live = invoice.swaps.find((s) => s.status === "PENDING_DEPOSIT" && new Date(s.deadline).getTime() > now);
  if (live) {
    const until = new Date(live.deadline).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `Your client has a live quote for this total, so line items and currency are locked until ${until}.`;
  }
  if (invoice.payerMarkedPaidAt) return "Your client reported paying this total in ZEC. Check your wallet before changing the amount.";
  return null;
}

/** Why an invoice can't be edited at all, if it can't. Mirrors the API's rules. */
export function editBlocker(invoice: InvoiceDTO): string | null {
  if (invoice.link) return "Payments made through a payment link can't be edited.";
  if (invoice.status === "PAID") return "Paid invoices can't be edited.";
  if (invoice.status === "CANCELLED") return "Cancelled invoices can't be edited.";
  if (invoice.status === "PROCESSING") return "A payment is in flight. You can edit once it settles or is refunded.";
  return null;
}

export type InvoiceFormProps = {
  /** Present when editing. */
  invoice?: InvoiceDTO;
};

export function InvoiceForm({ invoice }: InvoiceFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { me, refresh } = useAuth();
  const editing = !!invoice;
  const [title, setTitle] = useState(invoice?.title ?? "");
  const [clientName, setClientName] = useState(invoice?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(invoice?.clientEmail ?? "");
  const [description, setDescription] = useState(invoice?.description ?? "");
  const [currency, setCurrency] = useState<"USD" | "ZEC">(invoice?.currency ?? "USD");
  const [dueDate, setDueDate] = useState(toDateInput(invoice?.dueDate ?? null));
  const [lines, setLines] = useState<Line[]>(() =>
    invoice ? invoice.lineItems.map((l) => newLine({ description: l.description, quantity: String(l.quantity), unitAmount: l.unitAmount })) : [newLine()],
  );
  // Errors only show after the first submit attempt, then update live as fields are fixed.
  const [attempted, setAttempted] = useState(false);
  const [state, setState] = useState<ButtonState>("idle");
  const [lockNow] = useState(() => Date.now());
  const locked = invoice ? priceLock(invoice, lockNow) : null;

  const total = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitAmount) || 0), 0), [lines]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const parsed = useMemo(
    () =>
      createInvoiceSchema.safeParse({
        title,
        clientName,
        clientEmail,
        description: description || undefined,
        currency,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
        lineItems: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitAmount: l.unitAmount.trim() })),
      }),
    [title, clientName, clientEmail, description, currency, dueDate, lines],
  );

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!attempted) return next;
    if (!parsed.success) for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
    return next;
  }, [attempted, parsed]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!parsed.success) return;
    const data: UpdateInvoiceInput = { ...parsed.data, dueDate: parsed.data.dueDate ?? null };

    setState("loading");
    try {
      const saved = editing
        ? await api<InvoiceDTO>(`/invoices/${invoice.id}`, { method: "PUT", body: data })
        : await api<InvoiceDTO>("/invoices", { body: data });
      setState("success");
      if (!editing) void refresh();
      router.push(`/dashboard/invoices/${saved.id}?${editing ? "edited" : "created"}=1`);
    } catch (err) {
      setState("error");
      toast.error(editing ? "Couldn't save changes" : "Couldn't create invoice", errorMessage(err));
      window.setTimeout(() => setState("idle"), 1500);
    }
  };

  if (!editing && me && me.totalAddresses === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">Add a shielded address first</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invoices settle directly to your Zcash wallet. Add a unified address (u1…) from Zashi so we know where to send funds.</p>
        <Link href="/dashboard/addresses" className="btn-solid mt-6 h-10 rounded-xl px-5 text-sm font-semibold">
          Add addresses
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <PageHeader
          title={editing ? `Edit invoice #${String(invoice.number).padStart(3, "0")}` : "New invoice"}
          description={editing ? "Changes show up on the payment page right away. The link stays the same." : "Your client picks how to pay. You receive shielded ZEC."}
        />

        <div className="card space-y-4 p-5">
          <TextField label="What's this for?" placeholder="Brand identity: logo & guidelines" value={title} onChange={setTitle} error={errors.title} />
          <div>
            <p className="mb-2 text-sm font-medium">Bill to</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField aria-label="Client name" placeholder="Client name" value={clientName} onChange={setClientName} autoComplete="off" />
              <TextField
                aria-label="Client email"
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={setClientEmail}
                error={errors.clientEmail}
                autoComplete="off"
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Optional. Shown on the invoice your client sees.</p>
          </div>
          <div>
            <FieldLabel htmlFor="notes">Notes for your client</FieldLabel>
            <textarea
              id="notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Thanks for the project! Payment terms: net 14."
              className={textareaClass}
            />
          </div>
        </div>

        <fieldset disabled={!!locked} className="card p-5">
          <legend className="sr-only">Line items</legend>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Line items</p>
            <Tabs value={currency} onValueChange={(v) => !locked && setCurrency(v as "USD" | "ZEC")} variant="segment">
              <TabsList>
                <TabsTrigger value="USD">USD</TabsTrigger>
                <TabsTrigger value="ZEC">ZEC</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {locked ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff4e0] p-3 text-xs leading-relaxed text-[#8a5300]">
              <Lock className="mt-0.5 size-3.5 shrink-0" /> {locked}
            </p>
          ) : null}
          <div className="mt-4 hidden grid-cols-[1fr_84px_140px_48px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Price ({currency})</span>
            <span />
          </div>
          <div className={cn("mt-2 space-y-2", locked && "opacity-60")}>
            <AnimatePresence initial={false}>
              {lines.map((line, i) => (
                <motion.div
                  key={line.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-[1fr_64px_100px_40px] gap-2 sm:grid-cols-[1fr_84px_140px_48px]"
                >
                  <input
                    aria-label="Item description"
                    className={cn(fieldClass, "px-3")}
                    placeholder="Logo concepts"
                    value={line.description}
                    onChange={(e) => update(line.key, { description: e.target.value })}
                  />
                  <input
                    aria-label="Quantity"
                    className={cn(fieldClass, "px-3 tabular")}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
                  />
                  <input
                    aria-label="Unit price"
                    className={cn(fieldClass, "px-3 tabular")}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.unitAmount}
                    onChange={(e) => update(line.key, { unitAmount: e.target.value.replace(/[^\d.]/g, "") })}
                  />
                  <button
                    type="button"
                    aria-label="Remove item"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                    className="grid h-12 w-full place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  {errors[`lineItems.${i}.description`] || errors[`lineItems.${i}.unitAmount`] || errors[`lineItems.${i}.quantity`] ? (
                    <p className="col-span-4 -mt-1 text-xs text-destructive">
                      {errors[`lineItems.${i}.description`] ?? errors[`lineItems.${i}.unitAmount`] ?? errors[`lineItems.${i}.quantity`]}
                    </p>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {!locked ? (
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, newLine()])}
              className="press mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-4" /> Add item
            </button>
          ) : null}
        </fieldset>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{currency === "USD" ? formatUsd(total) : `${formatAmount(total, 8)} ZEC`}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {currency === "USD"
              ? "Your client pays the USD value in any token. You receive ZEC worth this amount at the moment they pay."
              : "You receive exactly this much ZEC. Your client pays its value in any token."}
          </p>
          <div className="mt-5">
            <FieldLabel htmlFor="due">Due date (optional)</FieldLabel>
            <input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
          </div>
          <StatefulButton
            type="submit"
            className="mt-5 w-full"
            size="lg"
            state={state}
            loadingText={editing ? "Saving" : "Creating"}
            successText={editing ? "Saved" : "Created"}
          >
            {editing ? "Save changes" : "Create invoice"}
          </StatefulButton>
          {editing ? (
            <Link href={`/dashboard/invoices/${invoice.id}`} className="mt-2 grid h-10 place-items-center rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
          ) : null}
          {errors.lineItems ? <p className="mt-2 text-xs text-destructive">{errors.lineItems}</p> : null}
        </div>
        {!editing && me && me.freshAddresses === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
            No fresh shielded addresses left, so this invoice will reuse your default one.{" "}
            <Link href="/dashboard/addresses" className="underline">
              Add more
            </Link>
          </p>
        ) : null}
      </aside>
    </form>
  );
}
