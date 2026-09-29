import { ZEC_ASSET_ID, fromBaseUnits, quoteDeadline, type QuotePreviewDTO, type SwapDTO, type TokenDTO } from "@petrapay/shared";
import { prisma, type Invoice, type ShieldedAddress } from "../db.ts";
import { HttpError } from "../lib/http.ts";
import { MIN_ZEC_OUT_ZATS, invoiceZats } from "./invoices.ts";
import { QuoteRequest, requestQuote, requireToken, type QuoteResponse } from "./oneclick.ts";
import { createSwap, toSwapDTO } from "./swaps.ts";

/** A pending deposit address is reused if it has at least this long left before its deadline. */
const REUSE_MIN_REMAINING_MS = 15 * 60_000;

function toPreview(response: QuoteResponse): QuotePreviewDTO {
  const q = response.quote;
  return {
    amountIn: q.amountIn,
    amountInFormatted: q.amountInFormatted,
    amountInUsd: q.amountInUsd,
    minAmountIn: q.minAmountIn,
    amountOut: q.amountOut,
    amountOutFormatted: q.amountOutFormatted,
    amountOutUsd: q.amountOutUsd,
    timeEstimate: q.timeEstimate,
    confidentiality: response.quoteRequest.confidentiality ?? "public",
  };
}

async function payableToken(originAsset: string): Promise<TokenDTO> {
  if (originAsset === ZEC_ASSET_ID) throw new HttpError(400, "Pay ZEC directly to the shielded address instead.");
  return requireToken(originAsset);
}

/** EXACT_OUTPUT quote: the payer covers fees, the creator receives exactly `zats`. */
async function quoteToZec(p: { origin: TokenDTO; zats: bigint; recipient: string; refundTo?: string; dry: boolean }) {
  if (p.zats < MIN_ZEC_OUT_ZATS) throw new HttpError(400, "Amount is below the 0.001 ZEC bridge minimum.");
  // Dry quotes without a refund address use a placeholder Intents account; nothing is executed.
  const placeholderRefund = p.dry && !p.refundTo;
  return requestQuote({
    dry: p.dry,
    swapType: QuoteRequest.swapType.EXACT_OUTPUT,
    originAsset: p.origin.assetId,
    destinationAsset: ZEC_ASSET_ID,
    amount: p.zats,
    recipient: p.recipient,
    refundTo: placeholderRefund ? "intents.near" : p.refundTo!,
    refundType: placeholderRefund ? QuoteRequest.refundType.INTENTS : QuoteRequest.refundType.ORIGIN_CHAIN,
    deadline: quoteDeadline(p.origin.blockchain),
  }).catch((err: unknown) => {
    const min = err instanceof HttpError ? (err.details as { minBaseUnits?: string } | undefined)?.minBaseUnits : undefined;
    if (min) throw new HttpError(400, `Amount is below the bridge minimum for this route (min ${fromBaseUnits(min, 8)} ZEC).`);
    throw err;
  });
}

/** Non-binding quote for paying `amount` of an invoice or link, before any invoice exists. */
export async function previewPayment(p: { originAsset: string; currency: "USD" | "ZEC"; amount: string; recipient: string }): Promise<QuotePreviewDTO> {
  const origin = await payableToken(p.originAsset);
  const { zats } = await invoiceZats({ currency: p.currency, amount: p.amount });
  return toPreview(await quoteToZec({ origin, zats, recipient: p.recipient, dry: true }));
}

/** Dry preview or a live deposit address for paying an invoice with `originAsset`. */
export async function quoteInvoicePayment(
  invoice: Invoice & { address: ShieldedAddress },
  body: { originAsset: string; refundTo?: string; dry: boolean },
): Promise<QuotePreviewDTO | SwapDTO> {
  if (invoice.status === "PAID") throw new HttpError(409, "This invoice has already been paid.");
  if (invoice.status === "CANCELLED") throw new HttpError(409, "This invoice was cancelled by the creator.");
  const origin = await payableToken(body.originAsset);
  const { zats } = await invoiceZats(invoice);
  if (!body.dry && !body.refundTo) throw new HttpError(400, `Enter your ${origin.symbol} refund address`);

  if (!body.dry) {
    // Hand back the existing deposit address instead of minting a new one on every click.
    const existing = await prisma.swap.findFirst({
      where: {
        invoiceId: invoice.id,
        originAsset: origin.assetId,
        refundTo: body.refundTo!,
        status: "PENDING_DEPOSIT",
        deadline: { gt: new Date(Date.now() + REUSE_MIN_REMAINING_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return toSwapDTO(existing);
  }

  const response = await quoteToZec({ origin, zats, recipient: invoice.address.address, refundTo: body.refundTo, dry: body.dry });
  if (body.dry) return toPreview(response);

  const swap = await createSwap({ kind: "INVOICE_PAYMENT", creatorId: invoice.creatorId, invoiceId: invoice.id, swapType: "EXACT_OUTPUT", response });
  return toSwapDTO(swap);
}
