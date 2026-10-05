import type { InvoiceStatus, SwapStatus } from "@petrapay/shared";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";

const INVOICE: Record<InvoiceStatus, { status: AnimatedBadgeStatus; label: string }> = {
  OPEN: { status: "info", label: "Open" },
  PROCESSING: { status: "loading", label: "Processing" },
  PAID: { status: "success", label: "Paid" },
  CANCELLED: { status: "neutral", label: "Cancelled" },
  EXPIRED: { status: "neutral", label: "Expired" },
};

const SWAP: Record<SwapStatus, { status: AnimatedBadgeStatus; label: string }> = {
  PENDING_DEPOSIT: { status: "neutral", label: "Awaiting deposit" },
  KNOWN_DEPOSIT_TX: { status: "loading", label: "Deposit seen" },
  PROCESSING: { status: "loading", label: "Swapping" },
  SUCCESS: { status: "success", label: "Settled" },
  INCOMPLETE_DEPOSIT: { status: "warning", label: "Incomplete deposit" },
  REFUNDED: { status: "warning", label: "Refunded" },
  FAILED: { status: "danger", label: "Failed" },
  EXPIRED: { status: "neutral", label: "Expired" },
};

export function InvoiceStatusBadge({ status, overdue, size = "sm" }: { status: InvoiceStatus; overdue?: boolean; size?: "sm" | "md" }) {
  if (overdue && status === "OPEN") {
    return (
      <AnimatedBadge status="warning" size={size} contentKey="overdue">
        Overdue
      </AnimatedBadge>
    );
  }
  const s = INVOICE[status];
  return (
    <AnimatedBadge status={s.status} size={size} contentKey={status}>
      {s.label}
    </AnimatedBadge>
  );
}

export function SwapStatusBadge({ status, size = "sm" }: { status: SwapStatus; size?: "sm" | "md" }) {
  const s = SWAP[status];
  return (
    <AnimatedBadge status={s.status} size={size} contentKey={status}>
      {s.label}
    </AnimatedBadge>
  );
}

export function isOverdue(invoice: { status: InvoiceStatus; dueDate: string | null }) {
  return invoice.status === "OPEN" && !!invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();
}
