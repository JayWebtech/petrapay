import { formatAmount, formatUsd, type TokenDTO } from "@petrapay/shared";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Priced = { currency: "USD" | "ZEC"; amount: string; zecPriceUsd: number | null };

/** The amount's value in USD, if we can price it. */
export function invoiceUsd(invoice: Priced): number | null {
  const n = Number(invoice.amount);
  if (!(n > 0)) return null;
  if (invoice.currency === "USD") return n;
  return invoice.zecPriceUsd ? n * invoice.zecPriceUsd : null;
}

export function amountLabel(invoice: { currency: "USD" | "ZEC"; amount: string }) {
  return invoice.currency === "USD" ? formatUsd(invoice.amount) : `${formatAmount(invoice.amount, 8)} ZEC`;
}

/** Rough amount of `token` this costs, before fees. The quote gives the exact figure. */
export function estimateIn(token: TokenDTO, usd: number | null): string | null {
  if (!usd || !(token.priceUsd > 0)) return null;
  const n = usd / token.priceUsd;
  const digits = n >= 1000 ? 0 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return `≈ ${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ${token.symbol}`;
}

/** The headline figure, with USD cents dimmed. */
export function AmountHeading({
  currency,
  amount,
  placeholder,
  className,
}: {
  currency: "USD" | "ZEC";
  amount: string | null;
  placeholder?: string;
  className?: string;
}) {
  const base = cn("text-[40px] leading-none font-semibold tracking-[-0.04em] tabular sm:text-5xl lg:text-6xl", className);
  if (!amount || !(Number(amount) > 0)) return <h2 className={cn(base, "text-foreground/30")}>{placeholder ?? "—"}</h2>;
  const total = amountLabel({ currency, amount });
  const [whole, cents] = currency === "USD" ? total.split(".") : [total, undefined];
  return (
    <h2 className={base}>
      {whole}
      {cents ? <span className="text-foreground/35">.{cents}</span> : null}
    </h2>
  );
}

export function StepHeader({
  icon,
  title,
  body,
  onBack,
  backLabel = "Back",
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {backLabel}
        </button>
      ) : null}
      <span className="icon-tile size-14">{icon}</span>
      <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance md:text-[32px]">{title}</h1>
      {body ? <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
