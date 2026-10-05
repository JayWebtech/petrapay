import { z } from "zod";

// ---------- Request schemas (validated on the API, reused by forms) ----------

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a number")
  .refine((v) => Number(v) > 0, "Must be greater than zero");

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the item").max(200),
  quantity: z.number().positive().max(1_000_000),
  unitAmount: decimalString,
});

/** Trims optional form fields; an empty one counts as "not set". */
const blankToNull = (v: unknown) => (typeof v === "string" ? v.trim() || null : v);

export const createInvoiceSchema = z.object({
  title: z.string().trim().min(1, "Give the invoice a title").max(120),
  description: z.string().trim().max(2000).optional(),
  /** Encrypted in the creator's browser before upload ("enc1:…"), so the server never sees it. (Legacy.) */
  clientLabel: z.string().trim().max(512).optional(),
  /** Optional "billed to" details, shown on the payment page. */
  clientName: z.preprocess(blankToNull, z.string().max(120).nullable().optional()),
  clientEmail: z.preprocess(blankToNull, z.email("Enter a valid email address").max(200).nullable().optional()),
  currency: z.enum(["USD", "ZEC"]),
  lineItems: z.array(lineItemSchema).min(1).max(50),
  dueDate: z.iso.datetime().nullable().optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/** Full replacement of an invoice's editable fields; anything optional left out is cleared. The legacy client note is untouched. */
export const updateInvoiceSchema = createInvoiceSchema;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const addAddressSchema = z.object({
  address: z.string().trim().min(10).max(1000),
  label: z.string().trim().max(60).optional(),
});

export const addAddressesSchema = z.object({
  addresses: z.array(z.string().trim().min(10).max(1000)).min(1).max(200),
  label: z.string().trim().max(60).optional(),
});

export const payQuoteSchema = z.object({
  originAsset: z.string().min(3).max(200),
  refundTo: z.string().trim().max(200).optional(),
  dry: z.boolean(),
});
export type PayQuoteInput = z.infer<typeof payQuoteSchema>;

export const withdrawQuoteSchema = z.object({
  destinationAsset: z.string().min(3).max(200),
  recipient: z.string().trim().min(2).max(200),
  amountZec: decimalString,
  refundTo: z.string().trim().min(10).max(1000),
  dry: z.boolean(),
});
export type WithdrawQuoteInput = z.infer<typeof withdrawQuoteSchema>;

// ---------- Payment links ----------

export const LINK_FIELD_TYPES = ["text", "email", "phone", "textarea", "select"] as const;
export type LinkFieldType = (typeof LINK_FIELD_TYPES)[number];

export const linkFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    label: z.string().trim().min(1, "Give the field a label").max(60),
    type: z.enum(LINK_FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options?.length ?? 0) >= 2, { message: "Dropdowns need at least two options", path: ["options"] });
export type LinkField = z.infer<typeof linkFieldSchema>;

const optionalDecimal = decimalString.optional();

export const createLinkSchema = z
  .object({
    title: z.string().trim().min(1, "Give the link a title").max(120),
    description: z.string().trim().max(2000).optional(),
    currency: z.enum(["USD", "ZEC"]),
    amountType: z.enum(["FIXED", "CUSTOM"]),
    amount: optionalDecimal,
    minAmount: optionalDecimal,
    maxAmount: optionalDecimal,
    presets: z.array(decimalString).max(4).default([]),
    fields: z.array(linkFieldSchema).max(8).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.amountType === "FIXED" && !v.amount) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the price" });
    if (v.minAmount && v.maxAmount && Number(v.maxAmount) < Number(v.minAmount)) {
      ctx.addIssue({ code: "custom", path: ["maxAmount"], message: "Maximum must be at least the minimum" });
    }
    const ids = new Set<string>();
    v.fields.forEach((f, i) => {
      if (ids.has(f.id)) ctx.addIssue({ code: "custom", path: ["fields", i, "id"], message: "Duplicate field" });
      ids.add(f.id);
    });
  });
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export const updateLinkSchema = z.object({ active: z.boolean() });

export const linkQuoteSchema = z.object({
  amount: decimalString,
  originAsset: z.string().min(3).max(200),
});

export const linkCheckoutSchema = z.object({
  amount: decimalString,
  /** Form responses sealed to the creator's box key ("box1:…"). */
  responses: z.string().max(16_000).optional(),
  method: z.enum(["token", "zec"]),
  originAsset: z.string().min(3).max(200).optional(),
  refundTo: z.string().trim().max(200).optional(),
});

export const boxKeySchema = z.object({ boxPublicKey: z.string().regex(/^[0-9a-f]{64}$/) });

export const depositTxSchema = z.object({
  txHash: z.string().trim().min(8).max(200),
});

export const authVerifySchema = z.object({
  publicKey: z.string().regex(/^[0-9a-f]{64}$/),
  signature: z.string().regex(/^[0-9a-f]{128}$/),
  nonce: z.string().min(16).max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

// ---------- Response DTOs ----------

export type TokenDTO = {
  assetId: string;
  symbol: string;
  decimals: number;
  blockchain: string;
  priceUsd: number;
  contractAddress?: string;
};

export type SwapStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED"
  | "EXPIRED";

export const TERMINAL_SWAP_STATUSES: SwapStatus[] = ["SUCCESS", "REFUNDED", "FAILED", "EXPIRED"];

export type TxLink = { hash: string; explorerUrl: string };

export type SwapDTO = {
  id: string;
  kind: "INVOICE_PAYMENT" | "WITHDRAWAL";
  status: SwapStatus;
  originAsset: string;
  originSymbol: string;
  originChain: string;
  originDecimals: number;
  destinationAsset: string;
  destinationSymbol: string;
  destinationChain: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string | null;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string | null;
  recipient: string;
  depositAddress: string;
  depositMemo: string | null;
  deadline: string;
  timeEstimate: number | null;
  confidentiality: string;
  originTxs: TxLink[];
  destinationTxs: TxLink[];
  refundedAmountFormatted: string | null;
  createdAt: string;
  /** When the deposit was first seen on-chain. */
  detectedAt: string | null;
  settledAt: string | null;
};

export type QuotePreviewDTO = {
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  minAmountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  timeEstimate: number;
  confidentiality: string;
};

export type InvoiceStatus = "OPEN" | "PROCESSING" | "PAID" | "CANCELLED" | "EXPIRED";
export type InvoiceSource = "DASHBOARD" | "API" | "LINK";

export type LineItem = z.infer<typeof lineItemSchema>;

export type InvoiceDTO = {
  id: string;
  /** The payment link this invoice came from, if a payer created it through one. */
  link: { id: string; title: string } | null;
  /** Sealed form responses; only the creator's browser can open them. */
  responses: string | null;
  number: number;
  title: string;
  description: string | null;
  clientLabel: string | null;
  clientName: string | null;
  clientEmail: string | null;
  editedAt: string | null;
  source: InvoiceSource;
  /** Merchant order id and key/value pairs, set through the API. */
  reference: string | null;
  metadata: Record<string, string> | null;
  expiresAt: string | null;
  currency: "USD" | "ZEC";
  amount: string;
  lineItems: LineItem[];
  status: InvoiceStatus;
  dueDate: string | null;
  paidAt: string | null;
  receivedZec: string | null;
  payerMarkedPaidAt: string | null;
  settlementAddress: string;
  addressReused: boolean;
  createdAt: string;
  swaps: SwapDTO[];
};

export type PublicInvoiceDTO = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  clientName: string | null;
  clientEmail: string | null;
  currency: "USD" | "ZEC";
  amount: string;
  lineItems: LineItem[];
  status: InvoiceStatus;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  creatorName: string;
  /** Set when a payer started this payment from a payment link. */
  linkId: string | null;
  /** Checkout redirects set by the merchant through the API. */
  successUrl: string | null;
  cancelUrl: string | null;
  expiresAt: string | null;
  /** Present so payers can pay natively from a Zcash wallet. */
  zecDirect: { address: string; amountZec: string; uri: string } | null;
  zecPriceUsd: number | null;
};

export type AddressDTO = {
  id: string;
  address: string;
  label: string | null;
  orchard: boolean;
  sapling: boolean;
  transparent: boolean;
  isDefault: boolean;
  usedByInvoice: string | null;
  createdAt: string;
};

export type MeDTO = {
  id: string;
  publicKey: string;
  boxPublicKey: string | null;
  displayName: string | null;
  createdAt: string;
  freshAddresses: number;
  totalAddresses: number;
};

export type StatsDTO = {
  receivedZec: string;
  receivedUsdAtSettlement: string;
  paidCount: number;
  openCount: number;
  processingCount: number;
  openAmountUsd: string;
  withdrawnZec: string;
  zecPriceUsd: number | null;
  /** Daily buckets for the requested range (default 30 days), oldest first. */
  series: { date: string; zec: string; usd: string; count: number }[];
  /** Top tokens clients paid with, by settled USD value. */
  paidWith: { symbol: string; chain: string; count: number; usd: string }[];
};

export type PaymentLinkDTO = {
  id: string;
  title: string;
  description: string | null;
  currency: "USD" | "ZEC";
  amountType: "FIXED" | "CUSTOM";
  amount: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  presets: string[];
  fields: LinkField[];
  active: boolean;
  createdAt: string;
  stats: { started: number; paid: number; receivedZec: string; receivedUsd: string };
};

export type PaymentLinkDetailDTO = PaymentLinkDTO & { payments: InvoiceDTO[] };

export type PublicLinkDTO = {
  id: string;
  title: string;
  description: string | null;
  currency: "USD" | "ZEC";
  amountType: "FIXED" | "CUSTOM";
  amount: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  presets: string[];
  fields: LinkField[];
  active: boolean;
  creatorName: string;
  /** Payers seal form responses to this key. */
  boxPublicKey: string | null;
  zecPriceUsd: number | null;
};

export type LinkCheckoutDTO = { invoice: PublicInvoiceDTO; swap: SwapDTO | null };

export type ApiError = { error: string; details?: unknown };

// ---------- Merchant API (developers) ----------

export const WEBHOOK_EVENT_TYPES = ["checkout.created", "checkout.processing", "checkout.paid", "checkout.cancelled", "checkout.expired"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const createApiKeySchema = z.object({ name: z.string().trim().min(1, "Name the key").max(60) });

const webhookUrl = z.url({ protocol: /^https?$/, error: "Enter a full http(s) URL" }).max(2000);
const webhookEvents = z
  .array(z.union([z.literal("*"), z.enum(WEBHOOK_EVENT_TYPES)]))
  .min(1, "Pick at least one event")
  .max(WEBHOOK_EVENT_TYPES.length + 1);

export const createWebhookSchema = z.object({
  url: webhookUrl,
  description: z.string().trim().max(200).optional(),
  events: webhookEvents,
});
export const updateWebhookSchema = z.object({
  url: webhookUrl.optional(),
  description: z.string().trim().max(200).nullable().optional(),
  events: webhookEvents.optional(),
  active: z.boolean().optional(),
});

export type ApiKeyDTO = {
  id: string;
  name: string;
  /** "pp_sk_…a1b2" */
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
/** The only response that ever contains the full secret key. */
export type CreatedApiKeyDTO = { key: ApiKeyDTO; secret: string };

export type WebhookEndpointDTO = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  createdAt: string;
  /** Deliveries in the last 7 days. */
  recent: { total: number; failed: number; pending: number; lastAt: string | null };
};
export type WebhookEndpointDetailDTO = WebhookEndpointDTO & { secret: string };

export type WebhookDeliveryDTO = {
  id: string;
  eventId: string;
  eventType: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  payload: unknown;
};

// ---------- Public API v1 (snake_case, Stripe-style) ----------

const redirectUrl = z.url({ protocol: /^https?$/, error: "Must be a full http(s) URL" }).max(2000);

export const v1LineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(1_000_000).default(1),
  unit_amount: decimalString,
});

export const v1CreateCheckoutSchema = z
  .object({
    currency: z.enum(["USD", "ZEC"]),
    /** Total to charge. Give either this or line_items. */
    amount: decimalString.optional(),
    line_items: z.array(v1LineItemSchema).min(1).max(50).optional(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    reference: z.string().trim().min(1).max(200).optional(),
    metadata: z
      .record(z.string().min(1).max(40), z.string().max(500))
      .refine((m) => Object.keys(m).length <= 20, "At most 20 metadata keys")
      .optional(),
    customer: z.object({ name: z.string().trim().max(120).optional(), email: z.email().max(200).optional() }).optional(),
    success_url: redirectUrl.optional(),
    cancel_url: redirectUrl.optional(),
    /** Seconds until the checkout stops accepting new payments (5 minutes to 7 days, default 24 hours). */
    expires_in: z
      .number()
      .int()
      .min(300)
      .max(7 * 86_400)
      .optional(),
  })
  .refine((v) => !!v.amount !== !!v.line_items, { message: "Provide either amount or line_items", path: ["amount"] });
export type V1CreateCheckoutInput = z.infer<typeof v1CreateCheckoutSchema>;

export const v1CreatePaymentLinkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  currency: z.enum(["USD", "ZEC"]),
  amount_type: z.enum(["fixed", "custom"]),
  amount: decimalString.optional(),
  min_amount: decimalString.optional(),
  max_amount: decimalString.optional(),
  presets: z.array(decimalString).max(4).optional(),
});
export const v1UpdatePaymentLinkSchema = z.object({ active: z.boolean() });
