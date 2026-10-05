import {
  ZEC_ASSET_ID,
  formatZats,
  toBaseUnits,
  usdToBaseUnits,
  zip321Uri,
  type InvoiceDTO,
  type LineItem,
  type PublicInvoiceDTO,
} from "@petrapay/shared";
import { Prisma, prisma, type Invoice, type ShieldedAddress, type Swap } from "../db.ts";
import { HttpError } from "../lib/http.ts";
import { publicId } from "../lib/ids.ts";
import { getToken } from "./oneclick.ts";
import { toSwapDTO } from "./swaps.ts";
import { emitCheckoutEvent } from "./webhooks.ts";

/** Bridge minimum for ZEC withdrawals from NEAR Intents (0.001 ZEC). */
export const MIN_ZEC_OUT_ZATS = 100_000n;

const DECIMALS = { USD: 2, ZEC: 8 } as const;

/** Rejects amounts finer than the currency allows (cents for USD, zats for ZEC). */
export function assertPrecision(value: string, currency: "USD" | "ZEC", label = "Amount") {
  const frac = value.split(".")[1] ?? "";
  if (frac.length > DECIMALS[currency]) throw new HttpError(400, `${label} can have at most ${DECIMALS[currency]} decimals`);
}

/** The invoice total for these line items, or a 400 if it's below what the swap route can deliver. */
export function invoiceTotal(lineItems: LineItem[], currency: "USD" | "ZEC"): string {
  for (const item of lineItems) assertPrecision(item.unitAmount, currency, "Unit amount");
  const amount = sumLineItems(lineItems, currency);
  if (Number(amount) <= 0) throw new HttpError(400, "The total must be greater than zero", { param: "amount" });
  if (currency === "USD" && Number(amount) < 1) throw new HttpError(400, "The total must be at least $1.00", { param: "amount" });
  if (currency === "ZEC" && Number(amount) < 0.001) throw new HttpError(400, "The total must be at least 0.001 ZEC", { param: "amount" });
  return amount;
}

/** True once a checkout's expiry has passed. */
export function isPastExpiry(invoice: { expiresAt: Date | null }, now = Date.now()): boolean {
  return !!invoice.expiresAt && invoice.expiresAt.getTime() <= now;
}

export function sumLineItems(items: LineItem[], currency: "USD" | "ZEC"): string {
  const decimals = currency === "USD" ? 2 : 8;
  // Quantities can be fractional (e.g. 1.5 hours); scale them to 4 dp to stay in integer math.
  let total = 0n;
  for (const item of items) {
    const unit = toBaseUnits(item.unitAmount, decimals);
    const qty = BigInt(Math.round(item.quantity * 10_000));
    total += (unit * qty + 5_000n) / 10_000n;
  }
  const base = 10n ** BigInt(decimals);
  return `${total / base}.${(total % base).toString().padStart(decimals, "0")}`;
}

/** The exact ZEC (in zats) the creator should receive for this invoice right now. */
export async function invoiceZats(invoice: { currency: "USD" | "ZEC"; amount: { toString(): string } }): Promise<{ zats: bigint; zecPriceUsd: number | null }> {
  const zec = await getToken(ZEC_ASSET_ID);
  const price = zec?.priceUsd ?? null;
  if (invoice.currency === "ZEC") return { zats: toBaseUnits(invoice.amount.toString(), 8), zecPriceUsd: price };
  if (!price) throw new HttpError(503, "ZEC price is unavailable right now. Try again in a minute.");
  return { zats: usdToBaseUnits(invoice.amount.toString(), price, 8), zecPriceUsd: price };
}

/** Takes the oldest unused address from the creator's pool, falling back to reusing their default. */
export async function assignAddress(creatorId: string): Promise<{ address: ShieldedAddress; reused: boolean }> {
  return prisma.$transaction(async (tx) => {
    // SKIP LOCKED stops two concurrent invoices from claiming the same fresh address.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ShieldedAddress"
      WHERE "creatorId" = ${creatorId} AND "assignedAt" IS NULL
      ORDER BY "isDefault" ASC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    const fresh = rows[0];
    if (fresh) {
      const address = await tx.shieldedAddress.update({ where: { id: fresh.id }, data: { assignedAt: new Date() } });
      return { address, reused: false };
    }
    const fallback =
      (await tx.shieldedAddress.findFirst({ where: { creatorId, isDefault: true } })) ??
      (await tx.shieldedAddress.findFirst({ where: { creatorId }, orderBy: { createdAt: "desc" } }));
    if (!fallback) throw new HttpError(400, "Add a shielded Zcash address before creating invoices.");
    return { address: fallback, reused: true };
  });
}

/** Relations every invoice DTO needs. */
export const INVOICE_INCLUDE = { address: true, swaps: true, link: { select: { id: true, title: true } } } as const;

type InvoiceWithRelations = Invoice & { address: ShieldedAddress; swaps: Swap[]; link?: { id: string; title: string } | null };

/** Creates an invoice with the next number and a fresh address from the pool. */
export async function createInvoice(
  creatorId: string,
  data: {
    title: string;
    description?: string | null;
    clientLabel?: string | null;
    clientName?: string | null;
    clientEmail?: string | null;
    lineItems: LineItem[];
    currency: "USD" | "ZEC";
    amount: string;
    dueDate?: Date | null;
    linkId?: string;
    responses?: string | null;
    source?: "DASHBOARD" | "API" | "LINK";
    reference?: string | null;
    metadata?: Record<string, string> | null;
    successUrl?: string | null;
    cancelUrl?: string | null;
    expiresAt?: Date | null;
  },
) {
  const { address, reused } = await assignAddress(creatorId);
  return prisma.$transaction(async (tx) => {
    const { invoiceSeq } = await tx.creator.update({
      where: { id: creatorId },
      data: { invoiceSeq: { increment: 1 } },
      select: { invoiceSeq: true },
    });
    return tx.invoice.create({
      data: {
        id: publicId(),
        number: invoiceSeq,
        creatorId,
        title: data.title,
        description: data.description || null,
        clientLabel: data.clientLabel || null,
        clientName: data.clientName || null,
        clientEmail: data.clientEmail || null,
        lineItems: data.lineItems as Prisma.InputJsonValue,
        currency: data.currency,
        amount: data.amount,
        addressId: address.id,
        addressReused: reused,
        dueDate: data.dueDate ?? null,
        linkId: data.linkId,
        responses: data.responses || null,
        source: data.source ?? (data.linkId ? "LINK" : "DASHBOARD"),
        reference: data.reference ?? null,
        metadata: data.metadata ?? undefined,
        successUrl: data.successUrl ?? null,
        cancelUrl: data.cancelUrl ?? null,
        expiresAt: data.expiresAt ?? null,
      },
      include: INVOICE_INCLUDE,
    });
  });
}

/** Cancels an open (or expired) invoice; rejects when money is already moving or has arrived. */
export async function cancelInvoice(invoice: Pick<Invoice, "id" | "status">) {
  if (invoice.status === "PAID") throw new HttpError(409, "Paid invoices can't be cancelled");
  if (invoice.status === "PROCESSING") throw new HttpError(409, "A payment is in flight. Wait for it to settle or refund.");
  if (invoice.status === "CANCELLED") throw new HttpError(409, "This invoice is already cancelled");
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: INVOICE_INCLUDE,
  });
  void emitCheckoutEvent(invoice.id, "checkout.cancelled");
  return updated;
}

/** Undoes createInvoice when the payment it was for couldn't start, returning the address to the pool. */
export async function discardInvoice(invoice: Pick<Invoice, "id" | "addressId" | "addressReused">) {
  await prisma.invoice.delete({ where: { id: invoice.id } });
  if (!invoice.addressReused) {
    await prisma.shieldedAddress.update({ where: { id: invoice.addressId }, data: { assignedAt: null } });
  }
}

export async function toInvoiceDTO(invoice: InvoiceWithRelations): Promise<InvoiceDTO> {
  const swaps = await Promise.all(
    [...invoice.swaps].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toSwapDTO),
  );
  return {
    id: invoice.id,
    link: invoice.link ?? null,
    responses: invoice.responses,
    number: invoice.number,
    title: invoice.title,
    description: invoice.description,
    clientLabel: invoice.clientLabel,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    editedAt: invoice.editedAt?.toISOString() ?? null,
    source: invoice.source,
    reference: invoice.reference,
    metadata: (invoice.metadata as Record<string, string> | null) ?? null,
    expiresAt: invoice.expiresAt?.toISOString() ?? null,
    currency: invoice.currency,
    amount: invoice.amount.toString(),
    lineItems: invoice.lineItems as LineItem[],
    status: invoice.status,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    receivedZec: invoice.receivedZats !== null ? formatZats(invoice.receivedZats) : null,
    payerMarkedPaidAt: invoice.payerMarkedPaidAt?.toISOString() ?? null,
    settlementAddress: invoice.address.address,
    addressReused: invoice.addressReused,
    createdAt: invoice.createdAt.toISOString(),
    swaps,
  };
}

export async function toPublicInvoiceDTO(
  invoice: Invoice & { address: ShieldedAddress; creator: { displayName: string | null } },
): Promise<PublicInvoiceDTO> {
  let zecDirect: PublicInvoiceDTO["zecDirect"] = null;
  let zecPriceUsd: number | null = null;
  // Expired checkouts stop offering a direct ZEC address too.
  if (invoice.status === "OPEN" && !isPastExpiry(invoice)) {
    try {
      const { zats, zecPriceUsd: price } = await invoiceZats(invoice);
      zecPriceUsd = price;
      const amountZec = formatZats(zats);
      zecDirect = {
        address: invoice.address.address,
        amountZec,
        uri: zip321Uri({
          address: invoice.address.address,
          amountZats: zats,
          memo: `PetraPay invoice ${invoice.id}`,
        }),
      };
    } catch {
      // Price feed unavailable: the page still works for cross-chain payment.
    }
  }
  return {
    id: invoice.id,
    number: invoice.number,
    title: invoice.title,
    description: invoice.description,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    currency: invoice.currency,
    amount: invoice.amount.toString(),
    lineItems: invoice.lineItems as LineItem[],
    status: invoice.status,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    creatorName: invoice.creator.displayName ?? "A PetraPay creator",
    linkId: invoice.linkId,
    successUrl: invoice.successUrl,
    cancelUrl: invoice.cancelUrl,
    expiresAt: invoice.expiresAt?.toISOString() ?? null,
    zecDirect,
    zecPriceUsd,
  };
}
