import type { InvoiceStatus, SwapStatus } from "@petrapay/shared";
import { AlertTriangle, Check, Circle, Clock, Loader2, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isOverdue } from "../status-badge";

type Tone = "success" | "info" | "progress" | "neutral" | "warning" | "danger";

const TONE: Record<Tone, string> = {
  success: "bg-[#e7f6ec] text-[#0e6b35]",
  info: "bg-[#eeecfd] text-[#3b28cc]",
  progress: "bg-[#fff4e0] text-[#8a5300]",
  neutral: "bg-[#f1f0f5] text-[#5d5b6e]",
  warning: "bg-[#fff1e6] text-[#9a3f00]",
  danger: "bg-[#fdecec] text-[#b42318]",
};

const ICON: Record<Tone, ReactNode> = {
  success: <Check className="size-3" strokeWidth={3} />,
  info: <Circle className="size-2.5" strokeWidth={3} />,
  progress: <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />,
  neutral: <X className="size-3" strokeWidth={2.5} />,
  warning: <Clock className="size-3" strokeWidth={2.5} />,
  danger: <AlertTriangle className="size-3" strokeWidth={2.5} />,
};

/** Compact status pill: icon + label, so state is never color alone. */
export function Pill({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap", TONE[tone])}>
      {icon ?? ICON[tone]}
      {children}
    </span>
  );
}

export function InvoicePill({ status, dueDate = null }: { status: InvoiceStatus; dueDate?: string | null }) {
  if (isOverdue({ status, dueDate })) return <Pill tone="warning">Overdue</Pill>;
  if (status === "PAID") return <Pill tone="success">Paid</Pill>;
  if (status === "PROCESSING") return <Pill tone="progress">Processing</Pill>;
  if (status === "CANCELLED") return <Pill tone="neutral">Cancelled</Pill>;
  return <Pill tone="info">Open</Pill>;
}

const SWAP: Record<SwapStatus, [Tone, string]> = {
  PENDING_DEPOSIT: ["info", "Awaiting deposit"],
  KNOWN_DEPOSIT_TX: ["progress", "Deposit seen"],
  PROCESSING: ["progress", "Swapping"],
  SUCCESS: ["success", "Settled"],
  INCOMPLETE_DEPOSIT: ["warning", "Incomplete"],
  REFUNDED: ["neutral", "Refunded"],
  FAILED: ["danger", "Failed"],
  EXPIRED: ["neutral", "Expired"],
};

export function SwapPill({ status }: { status: SwapStatus }) {
  const [tone, label] = SWAP[status];
  return (
    <Pill tone={tone} icon={status === "REFUNDED" ? <RotateCcw className="size-3" strokeWidth={2.5} /> : undefined}>
      {label}
    </Pill>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(17,15,36,0.04)]", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}
