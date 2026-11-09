export type Currency = 'USD' | 'ZEC';

export type SaleStatus = 'OPEN' | 'PROCESSING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

/** The terminal's own view of the account (GET /terminal/me). */
export interface Me {
  merchantName: string;
  deviceName: string;
  canAcceptPayments: boolean;
  freshAddresses: number;
}

/** A sale rung up on this terminal (see apps/api/src/routes/pos.ts). */
export interface Sale {
  id: string;
  number: number;
  status: SaleStatus;
  amount: string;
  currency: Currency;
  note: string;
  /** The hosted checkout the customer opens by scanning; doubles as their receipt link. */
  checkoutUrl: string;
  /** PNG data URL of checkoutUrl, sent when the sale is created or asked for with ?qr=1. */
  qrDataUrl: string | null;
  paidWith: { symbol: string; chain: string; amount: string } | null;
  received: { zec: string; usd: string | null } | null;
  /** The customer said they paid in shielded ZEC directly; the merchant confirms in the dashboard. */
  customerReportedZec: boolean;
  txHash: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
}
