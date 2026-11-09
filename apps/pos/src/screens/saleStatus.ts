import type { Sale } from '../api/types';
import type { Tone } from '../components/ui';
import { chainName } from '../lib/format';

/** Sales whose status can still change, so the till keeps watching them. */
export const isLive = (s: Sale) => s.status === 'OPEN' || s.status === 'PROCESSING';

export function statusLabel(s: Sale): { label: string; tone: Tone } {
  switch (s.status) {
    case 'OPEN':
      return s.customerReportedZec ? { label: 'Check your wallet', tone: 'warning' } : { label: 'Awaiting payment', tone: 'neutral' };
    case 'PROCESSING':
      return { label: 'Payment received', tone: 'info' };
    case 'PAID':
      return { label: 'Paid', tone: 'success' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'neutral' };
  }
}

/** What the cashier should know or do now. */
export function statusHint(s: Sale): string {
  switch (s.status) {
    case 'OPEN':
      return s.customerReportedZec
        ? "The customer says they paid in shielded ZEC. Check your Zcash wallet; it can't be confirmed automatically. Mark it paid from your dashboard once it arrives."
        : 'Ask the customer to scan with their phone camera. They can pay with any token or with shielded ZEC.';
    case 'PROCESSING':
      return `${s.paidWith ? `${s.paidWith.symbol} on ${chainName(s.paidWith.chain)} received. ` : ''}It's being converted to shielded ZEC, usually within a few minutes. You can start the next sale; this one finishes on its own.`;
    case 'PAID':
      return 'Payment received. You can hand over the goods.';
    case 'CANCELLED':
      return 'You cancelled this sale. If the customer already started paying, it still completes, or is refunded to them.';
    case 'EXPIRED':
      return 'No payment arrived in time. Start a new sale if the customer still wants to pay.';
  }
}
