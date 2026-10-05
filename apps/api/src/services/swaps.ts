import { TERMINAL_SWAP_STATUSES, type SwapDTO, type SwapStatus, type TxLink } from "@petrapay/shared";
import { Prisma, prisma, type Swap, type SwapKind } from "../db.ts";
import { getStatus, getToken, type GetExecutionStatusResponse, type QuoteResponse } from "./oneclick.ts";
import { emitCheckoutEvent } from "./webhooks.ts";


type SwapDetails = GetExecutionStatusResponse["swapDetails"];

export async function createSwap(args: {
  kind: SwapKind;
  creatorId: string;
  invoiceId?: string;
  swapType: string;
  response: QuoteResponse;
}): Promise<Swap> {
  const { quote, quoteRequest } = args.response;
  return prisma.swap.create({
    data: {
      kind: args.kind,
      creatorId: args.creatorId,
      invoiceId: args.invoiceId,
      swapType: args.swapType,
      originAsset: quoteRequest.originAsset,
      destinationAsset: quoteRequest.destinationAsset,
      amountIn: quote.amountIn,
      amountInFormatted: quote.amountInFormatted,
      amountInUsd: quote.amountInUsd ?? null,
      amountOut: quote.amountOut,
      amountOutFormatted: quote.amountOutFormatted,
      amountOutUsd: quote.amountOutUsd ?? null,
      recipient: quoteRequest.recipient,
      refundTo: quoteRequest.refundTo,
      depositAddress: quote.depositAddress!,
      depositMemo: quote.depositMemo ?? null,
      deadline: new Date(quoteRequest.deadline),
      inactiveAt: new Date(quote.timeWhenInactive ?? quote.deadline ?? quoteRequest.deadline),
      timeEstimate: quote.timeEstimate ?? null,
      confidentiality: quoteRequest.confidentiality ?? "public",
      correlationId: args.response.correlationId,
      quoteResponse: args.response as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function toSwapDTO(swap: Swap): Promise<SwapDTO> {
  const [origin, destination] = await Promise.all([getToken(swap.originAsset), getToken(swap.destinationAsset)]);
  const details = (swap.swapDetails ?? null) as SwapDetails | null;
  const txs = (list: TxLink[] | undefined) => (list ?? []).map((t) => ({ hash: t.hash, explorerUrl: t.explorerUrl }));
  return {
    id: swap.id,
    kind: swap.kind,
    status: swap.status as SwapStatus,
    originAsset: swap.originAsset,
    originSymbol: origin?.symbol ?? "?",
    originChain: origin?.blockchain ?? "unknown",
    originDecimals: origin?.decimals ?? 0,
    destinationAsset: swap.destinationAsset,
    destinationSymbol: destination?.symbol ?? "?",
    destinationChain: destination?.blockchain ?? "unknown",
    amountIn: swap.amountIn,
    amountInFormatted: swap.amountInFormatted,
    amountInUsd: swap.amountInUsd,
    amountOut: details?.amountOut ?? swap.amountOut,
    amountOutFormatted: details?.amountOutFormatted ?? swap.amountOutFormatted,
    amountOutUsd: details?.amountOutUsd ?? swap.amountOutUsd,
    recipient: swap.recipient,
    depositAddress: swap.depositAddress,
    depositMemo: swap.depositMemo,
    deadline: swap.deadline.toISOString(),
    timeEstimate: swap.timeEstimate,
    confidentiality: swap.confidentiality,
    originTxs: txs(details?.originChainTxHashes),
    destinationTxs: txs(details?.destinationChainTxHashes),
    refundedAmountFormatted: details?.refundedAmountFormatted ?? null,
    createdAt: swap.createdAt.toISOString(),
    detectedAt: swap.detectedAt?.toISOString() ?? null,
    settledAt: swap.settledAt?.toISOString() ?? null,
  };
}

export function isTerminal(status: string): boolean {
  return TERMINAL_SWAP_STATUSES.includes(status as SwapStatus);
}

/** Statuses that mean the deposit has arrived. */
const DETECTED: SwapStatus[] = ["KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "REFUNDED", "FAILED"];

/** Pulls the latest status from 1Click and applies any transition. Returns the updated swap. */
export async function refreshSwap(swap: Swap): Promise<Swap> {
  if (isTerminal(swap.status)) return swap;

  let remote: GetExecutionStatusResponse | null = null;
  try {
    remote = await getStatus(swap.depositAddress, swap.depositMemo);
  } catch {
    // 1Click returns 404 until it has seen activity on some addresses; fall through to expiry logic.
  }

  let status = (remote?.status ?? swap.status) as SwapStatus;
  if (status === "PENDING_DEPOSIT" && Date.now() > swap.inactiveAt.getTime()) {
    status = "EXPIRED";
  }

  const changed = status !== swap.status;
  const updated = await prisma.swap.update({
    where: { id: swap.id },
    data: {
      status,
      lastCheckedAt: new Date(),
      ...(remote ? { swapDetails: remote.swapDetails as unknown as Prisma.InputJsonValue } : {}),
      ...(DETECTED.includes(status) && !swap.detectedAt ? { detectedAt: new Date() } : {}),
      ...(status === "SUCCESS" && !swap.settledAt ? { settledAt: new Date() } : {}),
    },
  });

  if (changed && updated.invoiceId) await recomputeInvoice(updated.invoiceId);
  return updated;
}

/** Derives invoice status from its swaps. Money that actually arrived always wins, even on a cancelled invoice. */
export async function recomputeInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { swaps: true } });
  if (!invoice) return;

  const settled = invoice.swaps.filter((s) => s.status === "SUCCESS");
  if (settled.length > 0) {
    let zats = 0n;
    let usd = 0;
    for (const s of settled) {
      const details = s.swapDetails as SwapDetails | null;
      zats += BigInt(details?.amountOut ?? s.amountOut);
      usd += Number(details?.amountOutUsd ?? s.amountOutUsd ?? 0);
    }
    const paidAt = settled.map((s) => s.settledAt ?? s.updatedAt).sort((a, b) => a.getTime() - b.getTime())[0]!;
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: invoice.paidAt ?? paidAt, receivedZats: zats, receivedUsd: usd.toFixed(2) },
    });
    if (invoice.status !== "PAID") await emitCheckoutEvent(invoiceId, "checkout.paid");
    return;
  }

  if (invoice.status === "CANCELLED" || invoice.status === "PAID" || invoice.status === "EXPIRED") return;
  const inFlight = invoice.swaps.some((s) => ["KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"].includes(s.status));
  const next = inFlight ? "PROCESSING" : "OPEN";
  if (next !== invoice.status) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: next } });
    if (next === "PROCESSING") await emitCheckoutEvent(invoiceId, "checkout.processing");
  }
}
