"use client";

import type { LinkField, PublicLinkDTO } from "@petrapay/shared";
import { ArrowRight, ChevronDown, HandCoins, Lock, PenLine } from "lucide-react";
import { useState, type FormEvent } from "react";
import { StepHeader } from "@/components/app/checkout/utils";
import { FieldLabel, fieldClass, textareaClass } from "@/components/app/field";
import { cn } from "@/lib/utils";
import { amountError, fieldError, money, presetLabel, rangeHint, sanitizeAmount } from "./validate";

type Errors = Record<string, string>;

/** Amount (when the payer picks it) and the creator's form, before choosing how to pay. */
export function DetailsStep({
  link,
  amount,
  onAmount,
  values,
  onValue,
  onContinue,
}: {
  link: PublicLinkDTO;
  amount: string;
  onAmount: (amount: string) => void;
  values: Record<string, string>;
  onValue: (id: string, value: string) => void;
  onContinue: () => void;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const custom = link.amountType === "CUSTOM";
  const hint = rangeHint(link);

  const clear = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const amountProblem = custom ? amountError(link, amount) : null;
    if (amountProblem) next.amount = amountProblem;
    for (const f of link.fields) {
      const problem = fieldError(f, values[f.id] ?? "");
      if (problem) next[f.id] = problem;
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    onContinue();
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeader
        icon={custom ? <HandCoins className="size-6" /> : <PenLine className="size-6" />}
        title={custom ? "Choose an amount" : "Your details"}
        body={
          custom
            ? link.fields.length
              ? `Decide what to pay ${link.creatorName}, then add a few details.`
              : `Pay ${link.creatorName} whatever feels right.`
            : `${link.creatorName} asks for a few details with this payment.`
        }
      />

      <div className="mt-8 space-y-5">
        {custom ? (
          <div>
            <FieldLabel htmlFor="f-amount">Amount</FieldLabel>
            <div
              className={cn(
                "flex h-16 w-full items-center gap-1.5 rounded-2xl border bg-white px-4 shadow-[0_2px_0_0_#eeedf5] transition-[border-color,box-shadow] focus-within:ring-4",
                errors.amount
                  ? "border-destructive/60 ring-4 ring-destructive/10"
                  : "border-border focus-within:border-primary/50 focus-within:ring-primary/10",
              )}
            >
              {link.currency === "USD" ? <span className="text-2xl font-semibold text-muted-foreground/70">$</span> : null}
              <input
                id="f-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => {
                  onAmount(sanitizeAmount(e.target.value, link.currency));
                  clear("amount");
                }}
                placeholder={link.currency === "USD" ? "0.00" : "0.000"}
                aria-invalid={!!errors.amount}
                aria-describedby="f-amount-hint"
                className="h-full min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/40"
              />
              {link.currency === "ZEC" ? <span className="text-base font-medium text-muted-foreground">ZEC</span> : null}
            </div>
            {link.presets.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {link.presets.map((p) => {
                  const active = amount !== "" && Number(amount) === Number(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        onAmount(p);
                        clear("amount");
                      }}
                      aria-pressed={active}
                      className={cn(
                        "press h-10 rounded-full border px-4 text-sm font-medium tabular transition-colors",
                        active ? "border-primary/60 bg-primary/[0.06] text-primary" : "border-border bg-white hover:border-[#d6d3e6]",
                      )}
                    >
                      {presetLabel(link.currency, p)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <p id="f-amount-hint" className={cn("mt-2 text-xs", errors.amount ? "text-destructive" : "text-muted-foreground")}>
              {errors.amount ?? hint ?? "You'll see the exact amount in your token, fees included, next."}
            </p>
          </div>
        ) : null}

        {link.fields.map((f) => (
          <FormField
            key={f.id}
            field={f}
            value={values[f.id] ?? ""}
            error={errors[f.id]}
            onChange={(v) => {
              onValue(f.id, v);
              clear(f.id);
            }}
          />
        ))}

        {link.fields.length ? (
          <p className="flex items-start gap-2 rounded-2xl bg-[#f6f5ff] p-3.5 text-xs leading-relaxed text-foreground/70">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Your answers are encrypted on this device. Only {link.creatorName} can read them, not PetraPay.
          </p>
        ) : null}
      </div>

      <button type="submit" className="btn-solid mt-8 h-14 w-full text-[15px] font-semibold">
        Continue{" "}
        {!custom || Number(amount) > 0 ? (
          <span className="font-normal opacity-80">· {money(link.currency, custom ? amount : link.amount!)}</span>
        ) : null}
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}

function FormField({ field, value, error, onChange }: { field: LinkField; value: string; error?: string; onChange: (value: string) => void }) {
  const id = `f-${field.id}`;
  const common = {
    id,
    value,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  const invalid = error ? "border-destructive/60 ring-4 ring-destructive/10 focus:border-destructive/60 focus:ring-destructive/10" : "";

  return (
    <div>
      <FieldLabel htmlFor={id} action={field.required ? null : <span className="text-xs text-muted-foreground">Optional</span>}>
        {field.label}
      </FieldLabel>
      {field.type === "textarea" ? (
        <textarea {...common} rows={3} maxLength={1000} onChange={(e) => onChange(e.target.value)} className={cn(textareaClass, invalid)} />
      ) : field.type === "select" ? (
        <div className="relative">
          <select
            {...common}
            onChange={(e) => onChange(e.target.value)}
            className={cn(fieldClass, "appearance-none pr-10", !value && "text-muted-foreground/60", invalid)}
          >
            <option value="">Select…</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      ) : (
        <input
          {...common}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          inputMode={field.type === "email" ? "email" : field.type === "phone" ? "tel" : undefined}
          autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : /name/i.test(field.label) ? "name" : "off"}
          maxLength={1000}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldClass, invalid)}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
