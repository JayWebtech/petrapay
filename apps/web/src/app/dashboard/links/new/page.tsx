"use client";

import { LINK_FIELD_TYPES, createLinkSchema, type LinkFieldType, type PaymentLinkDTO } from "@petrapay/shared";
import { AtSign, ChevronDown, HandCoins, Lock, MapPin, Phone, Plus, Tag, Trash2, User, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { PageHeader } from "@/components/app/dash/ui";
import { FieldLabel, TextField, fieldClass, textareaClass } from "@/components/app/field";
import { money, priceLabel } from "@/components/app/links/format";
import { UnlockWithPhrase } from "@/components/app/links/unlock-box";
import { useToast } from "@/components/app/toaster";
import { StatefulButton, type ButtonState } from "@/components/motion/button";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useDeviceBoxKey } from "@/hooks/use-responses";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<LinkFieldType, string> = {
  text: "Short text",
  email: "Email",
  phone: "Phone",
  textarea: "Long text",
  select: "Dropdown",
};

const QUICK_FIELDS: { label: string; type: LinkFieldType; icon: LucideIcon }[] = [
  { label: "Email", type: "email", icon: AtSign },
  { label: "Full name", type: "text", icon: User },
  { label: "Phone", type: "phone", icon: Phone },
  { label: "Shipping address", type: "textarea", icon: MapPin },
];

const MAX_FIELDS = 8;
const MAX_PRESETS = 4;

type Draft = { key: number; label: string; type: LinkFieldType; required: boolean; options: string };

let draftKey = 1;
const newDraft = (label = "", type: LinkFieldType = "text"): Draft => ({ key: draftKey++, label, type, required: true, options: "" });
const cleanAmount = (v: string) => v.replace(/,/g, ".").replace(/[^\d.]/g, "");
const splitOptions = (s: string) =>
  s
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

export default function NewLinkPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, refresh } = useAuth();
  const deviceBox = useDeviceBoxKey();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ZEC">("USD");
  const [amountType, setAmountType] = useState<"FIXED" | "CUSTOM">("FIXED");
  const [amount, setAmount] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [presetDraft, setPresetDraft] = useState("");
  const [fields, setFields] = useState<Draft[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [state, setState] = useState<ButtonState>("idle");

  const parsed = useMemo(
    () =>
      createLinkSchema.safeParse({
        title,
        description: description || undefined,
        currency,
        amountType,
        amount: amountType === "FIXED" ? amount || undefined : undefined,
        minAmount: amountType === "CUSTOM" ? minAmount || undefined : undefined,
        maxAmount: amountType === "CUSTOM" ? maxAmount || undefined : undefined,
        presets: amountType === "CUSTOM" ? presets : [],
        fields: fields.map((f, i) => ({
          id: `f${i + 1}`,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.type === "select" ? splitOptions(f.options) : undefined,
        })),
      }),
    [title, description, currency, amountType, amount, minAmount, maxAmount, presets, fields],
  );

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (attempted && !parsed.success) for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
    return next;
  }, [attempted, parsed]);

  // Answers are sealed to the account's box key; without one on file, fields can't be collected yet.
  const needsBoxKey = fields.length > 0 && !me?.boxPublicKey;
  const canPublishBox = needsBoxKey && !!deviceBox;

  // This device has the key but the account doesn't list it yet (an earlier upload failed): retry once.
  useEffect(() => {
    if (canPublishBox) void refresh();
  }, [canPublishBox, refresh]);

  const update = (key: number, patch: Partial<Draft>) => setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const addField = (label = "", type: LinkFieldType = "text") => setFields((fs) => (fs.length >= MAX_FIELDS ? fs : [...fs, newDraft(label, type)]));

  const addPreset = () => {
    const v = cleanAmount(presetDraft);
    if (!(Number(v) > 0) || presets.length >= MAX_PRESETS || presets.some((p) => Number(p) === Number(v))) return;
    setPresets((ps) => [...ps, v].sort((a, b) => Number(a) - Number(b)));
    setPresetDraft("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!parsed.success || needsBoxKey) return;
    setState("loading");
    try {
      const link = await api<PaymentLinkDTO>("/links", { body: parsed.data });
      setState("success");
      router.push(`/dashboard/links/${link.id}?created=1`);
    } catch (err) {
      setState("error");
      toast.error("Couldn't create link", errorMessage(err));
      window.setTimeout(() => setState("idle"), 1500);
    }
  };

  if (me && me.totalAddresses === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">Add a shielded address first</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Payments settle directly to your Zcash wallet. Add a unified address (u1…) from Zashi so we know where to send funds.
        </p>
        <Link href="/dashboard/addresses" className="btn-solid mt-6 h-10 rounded-xl px-5 text-sm font-semibold">
          Add addresses
        </Link>
      </div>
    );
  }

  const unit = currency === "USD" ? "$" : "ZEC";

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <PageHeader title="New payment link" description="Create it once, share it anywhere. Every payer gets their own private checkout." />

        <div className="card space-y-4 p-5">
          <TextField label="Title" placeholder="Poster print, A2" value={title} onChange={setTitle} error={errors.title} />
          <div>
            <FieldLabel htmlFor="description" action={<span className="text-xs text-muted-foreground">Optional</span>}>
              Description
            </FieldLabel>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Printed on 250gsm matte paper. Ships worldwide in 5 days."
              className={textareaClass}
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Pricing</p>
            <Tabs value={currency} onValueChange={(v) => setCurrency(v as "USD" | "ZEC")} variant="segment">
              <TabsList>
                <TabsTrigger value="USD">USD</TabsTrigger>
                <TabsTrigger value="ZEC">ZEC</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div role="radiogroup" aria-label="Amount" className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice
              active={amountType === "FIXED"}
              onClick={() => setAmountType("FIXED")}
              icon={Tag}
              title="Fixed price"
              body="Everyone pays the same amount."
            />
            <Choice
              active={amountType === "CUSTOM"}
              onClick={() => setAmountType("CUSTOM")}
              icon={HandCoins}
              title="Customer chooses"
              body="Tips, donations, pay what you want."
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={amountType}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-5"
            >
              {amountType === "FIXED" ? (
                <div className="max-w-xs">
                  <FieldLabel htmlFor="amount">Price</FieldLabel>
                  <MoneyInput id="amount" unit={unit} value={amount} onChange={setAmount} error={errors.amount} />
                  {errors.amount ? <p className="mt-2 text-xs text-destructive">{errors.amount}</p> : null}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="min" action={<span className="text-xs text-muted-foreground">Optional</span>}>
                        Minimum
                      </FieldLabel>
                      <MoneyInput
                        id="min"
                        unit={unit}
                        value={minAmount}
                        onChange={setMinAmount}
                        placeholder={currency === "USD" ? "1.00" : "0.001"}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="max" action={<span className="text-xs text-muted-foreground">Optional</span>}>
                        Maximum
                      </FieldLabel>
                      <MoneyInput id="max" unit={unit} value={maxAmount} onChange={setMaxAmount} error={errors.maxAmount} placeholder="No limit" />
                      {errors.maxAmount ? <p className="mt-2 text-xs text-destructive">{errors.maxAmount}</p> : null}
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor="preset" action={<span className="text-xs text-muted-foreground">Up to {MAX_PRESETS}</span>}>
                      Suggested amounts
                    </FieldLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <AnimatePresence initial={false}>
                        {presets.map((p) => (
                          <motion.span
                            key={p}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="inline-flex h-10 items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.05] pr-1.5 pl-3.5 text-sm font-medium text-primary tabular"
                          >
                            {money(currency, p).replace(/\.00$/, "")}
                            <button
                              type="button"
                              aria-label={`Remove ${money(currency, p)}`}
                              onClick={() => setPresets((ps) => ps.filter((x) => x !== p))}
                              className="grid size-6 place-items-center rounded-full hover:bg-primary/10"
                            >
                              <X className="size-3.5" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                      {presets.length < MAX_PRESETS ? (
                        <div className="flex h-10 items-center gap-1 rounded-full border border-dashed border-border bg-white pr-1 pl-3.5 focus-within:border-primary/50">
                          <span className="text-sm text-muted-foreground">{currency === "USD" ? "$" : ""}</span>
                          <input
                            id="preset"
                            inputMode="decimal"
                            value={presetDraft}
                            onChange={(e) => setPresetDraft(cleanAmount(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addPreset();
                              }
                            }}
                            placeholder={currency === "USD" ? "10" : "0.1"}
                            className="w-16 bg-transparent text-sm tabular outline-none placeholder:text-muted-foreground/60"
                          />
                          <button
                            type="button"
                            onClick={addPreset}
                            aria-label="Add suggested amount"
                            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Shown as one-tap buttons. Payers can still type their own amount.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Collect information</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Answers are encrypted in the payer&apos;s browser. Only you can read them.</p>
            </div>
            <span className="text-xs text-muted-foreground tabular">
              {fields.length}/{MAX_FIELDS}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {fields.map((f, i) => (
                <motion.div
                  key={f.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-border bg-[#fcfcfe] p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_150px_40px]">
                      <input
                        aria-label="Field label"
                        value={f.label}
                        onChange={(e) => update(f.key, { label: e.target.value })}
                        placeholder="Question or label"
                        className={cn(fieldClass, "px-3", errors[`fields.${i}.label`] && "border-destructive/60")}
                      />
                      <div className="relative col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
                        <select
                          aria-label="Field type"
                          value={f.type}
                          onChange={(e) => update(f.key, { type: e.target.value as LinkFieldType })}
                          className={cn(fieldClass, "appearance-none px-3 pr-9")}
                        >
                          {LINK_FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <button
                        type="button"
                        aria-label="Remove field"
                        onClick={() => setFields((fs) => fs.filter((x) => x.key !== f.key))}
                        className="col-start-2 row-start-1 grid h-12 w-full place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-destructive sm:col-start-auto sm:row-start-auto"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {f.type === "select" ? (
                      <input
                        aria-label="Dropdown options"
                        value={f.options}
                        onChange={(e) => update(f.key, { options: e.target.value })}
                        placeholder="Options, separated by commas: S, M, L, XL"
                        className={cn(fieldClass, "mt-2 px-3", errors[`fields.${i}.options`] && "border-destructive/60")}
                      />
                    ) : null}
                    <div className="mt-2.5 flex items-center justify-between gap-3 px-1">
                      <p className="min-w-0 text-xs text-destructive">{errors[`fields.${i}.label`] ?? errors[`fields.${i}.options`] ?? ""}</p>
                      <Switch
                        checked={f.required}
                        onCheckedChange={(v) => update(f.key, { required: v })}
                        label="Required"
                        className="shrink-0 text-xs"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {fields.length < MAX_FIELDS ? (
            <div className={cn("flex flex-wrap gap-2", fields.length ? "mt-4" : "mt-1")}>
              {QUICK_FIELDS.filter((q) => !fields.some((f) => f.label.trim().toLowerCase() === q.label.toLowerCase())).map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => addField(q.label, q.type)}
                  className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-sm text-foreground/80 transition-colors hover:border-[#d6d3e6] hover:text-foreground"
                >
                  <q.icon className="size-3.5 text-muted-foreground" /> {q.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addField()}
                className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plus className="size-3.5" /> Custom field
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Preview
          creatorName={me?.displayName ?? "You"}
          title={title}
          description={description}
          price={
            amountType === "FIXED"
              ? Number(amount) > 0
                ? money(currency, amount)
                : null
              : priceLabel({ currency, amountType, amount: null, minAmount: minAmount || null, maxAmount: maxAmount || null })
          }
          fields={fields}
        />
        {needsBoxKey && deviceBox === null ? (
          <UnlockWithPhrase
            title="Turn on encrypted answers"
            body="Enter your recovery phrase once on this device. It derives the key payers encrypt their answers to."
          />
        ) : null}
        <StatefulButton type="submit" className="w-full" size="lg" state={state} loadingText="Creating" successText="Created" disabled={needsBoxKey}>
          Create payment link
        </StatefulButton>
      </aside>
    </form>
  );
}

function Choice({
  active,
  onClick,
  icon: Icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary/60 bg-primary/[0.03]" : "border-border bg-white hover:border-[#d6d3e6]",
      )}
    >
      {active ? <motion.span layoutId="link-amount-type" className="absolute inset-0 rounded-2xl ring-2 ring-primary/15" /> : null}
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

function MoneyInput({
  id,
  unit,
  value,
  onChange,
  error,
  placeholder = "0.00",
}: {
  id: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const prefix = unit === "$";
  return (
    <div className="relative">
      {prefix ? <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-foreground">$</span> : null}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(cleanAmount(e.target.value))}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={cn(fieldClass, "tabular", prefix ? "pl-8" : "pr-14", error && "border-destructive/60 ring-4 ring-destructive/10")}
      />
      {!prefix ? <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

/** A miniature of the payer's checkout, updating as the form changes. */
function Preview({
  creatorName,
  title,
  description,
  price,
  fields,
}: {
  creatorName: string;
  title: string;
  description: string;
  price: string | null;
  fields: Draft[];
}) {
  return (
    <div className="card overflow-hidden">
      <p className="border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground">Preview</p>
      <div className="bg-[#2f63c4] bg-[url(/bg-1.png)] bg-cover bg-center p-3">
        <div className="rounded-2xl bg-white/92 p-4 backdrop-blur-md">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-white">
              {creatorName.slice(0, 1).toUpperCase()}
            </span>
            {creatorName}
          </p>
          <p className={cn("mt-3 text-2xl font-semibold tracking-tight tabular", !price && "text-foreground/30")}>{price ?? "—"}</p>
          <p className={cn("mt-1 text-sm", title ? "text-foreground/80" : "text-muted-foreground/60")}>{title || "Your link title"}</p>
          {description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        {fields.map((f) => (
          <PreviewField key={f.key} label={f.label || "Untitled field"} optional={!f.required}>
            {f.type === "textarea" ? "" : f.type === "select" ? (splitOptions(f.options)[0] ?? "Select…") : TYPE_LABEL[f.type]}
          </PreviewField>
        ))}
        {fields.length ? (
          <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <Lock className="size-3 text-primary" /> Encrypted for you only
          </p>
        ) : null}
        <div className="grid h-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-white">Continue</div>
      </div>
    </div>
  );
}

function PreviewField({ label, optional, children }: { label: string; optional: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex justify-between text-[11px] font-medium">
        <span className="truncate">{label}</span>
        {optional ? <span className="font-normal text-muted-foreground">Optional</span> : null}
      </p>
      <div className="flex h-8 items-center rounded-lg border border-border bg-white px-2.5 text-[11px] text-muted-foreground/60">{children}</div>
    </div>
  );
}
