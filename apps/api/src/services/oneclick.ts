import {
  ApiError,
  OneClickService,
  OpenAPI,
  QuoteRequest,
  verifyQuoteSignature,
  type GetExecutionStatusResponse,
  type QuoteResponse,
} from "@defuse-protocol/one-click-sdk-typescript";
import type { TokenDTO } from "@petrapay/shared";
import { env } from "../env.ts";
import { HttpError } from "../lib/http.ts";

OpenAPI.BASE = env.ONECLICK_BASE_URL;
if (env.ONECLICK_JWT) OpenAPI.TOKEN = env.ONECLICK_JWT;

export { QuoteRequest };
export type { QuoteResponse, GetExecutionStatusResponse };

// ---------- Token list (cached) ----------

const TOKEN_TTL_MS = 5 * 60_000;
let tokenCache: { at: number; tokens: TokenDTO[]; byId: Map<string, TokenDTO> } | null = null;
let inflight: Promise<TokenDTO[]> | null = null;

async function fetchTokens(): Promise<TokenDTO[]> {
  const raw = await OneClickService.getTokens();
  const tokens: TokenDTO[] = raw.map((t) => ({
    assetId: t.assetId,
    symbol: t.symbol,
    decimals: t.decimals,
    blockchain: t.blockchain,
    priceUsd: Number(t.price) || 0,
    contractAddress: t.contractAddress ?? undefined,
  }));
  tokenCache = { at: Date.now(), tokens, byId: new Map(tokens.map((t) => [t.assetId, t])) };
  return tokens;
}

export async function getTokens(): Promise<TokenDTO[]> {
  if (tokenCache && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.tokens;
  if (!inflight) {
    inflight = fetchTokens().finally(() => {
      inflight = null;
    });
  }
  try {
    return await inflight;
  } catch (err) {
    // Serve stale data rather than failing checkout if 1Click's token list hiccups.
    if (tokenCache) return tokenCache.tokens;
    throw err;
  }
}

export async function getToken(assetId: string): Promise<TokenDTO | undefined> {
  await getTokens();
  return tokenCache?.byId.get(assetId);
}

export async function requireToken(assetId: string): Promise<TokenDTO> {
  const token = await getToken(assetId);
  if (!token) throw new HttpError(400, "Unsupported token");
  return token;
}

// ---------- Quotes ----------

export type QuoteParams = {
  dry: boolean;
  swapType: QuoteRequest.swapType;
  originAsset: string;
  destinationAsset: string;
  amount: bigint;
  recipient: string;
  refundTo: string;
  refundType: QuoteRequest.refundType;
  deadline: Date;
};

export function confidentiality(): QuoteRequest.confidentiality {
  return env.ONECLICK_CONFIDENTIALITY as QuoteRequest.confidentiality;
}

/** Origin chains whose deposit addresses are shared and need a memo to identify the swap. */
const MEMO_CHAINS = new Set(["stellar"]);

export async function requestQuote(p: QuoteParams): Promise<QuoteResponse> {
  const origin = await getToken(p.originAsset);
  const memo = origin ? MEMO_CHAINS.has(origin.blockchain) : false;
  try {
    return await requestQuoteWithMode(p, memo ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE);
  } catch (err) {
    // New memo-based chains get picked up without a code change.
    if (!memo && err instanceof HttpError && /Incorrect depositMode/i.test(err.message)) {
      return requestQuoteWithMode(p, QuoteRequest.depositMode.MEMO);
    }
    throw err;
  }
}

async function requestQuoteWithMode(p: QuoteParams, depositMode: QuoteRequest.depositMode): Promise<QuoteResponse> {
  const request: QuoteRequest = {
    dry: p.dry,
    depositMode,
    swapType: p.swapType,
    slippageTolerance: env.SLIPPAGE_BPS,
    originAsset: p.originAsset,
    depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
    destinationAsset: p.destinationAsset,
    amount: p.amount.toString(),
    recipient: p.recipient,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    refundTo: p.refundTo,
    refundType: p.refundType,
    deadline: p.deadline.toISOString(),
    referral: env.ONECLICK_REFERRAL,
    // Previews favor speed; binding quotes give solvers longer to compete on price.
    quoteWaitingTimeMs: p.dry ? 800 : 2000,
    confidentiality: confidentiality(),
    ...(env.APP_FEE_BPS > 0 ? { appFees: [{ recipient: env.APP_FEE_RECIPIENT, fee: env.APP_FEE_BPS }] } : {}),
  };

  let response: QuoteResponse;
  try {
    response = await OneClickService.getQuote(request);
  } catch (err) {
    throw toHttpError(err, "Couldn't get a quote");
  }

  // 1Click signs every quote. Verify before trusting the deposit address.
  if (!verifyQuoteSignature(response as Parameters<typeof verifyQuoteSignature>[0])) {
    throw new HttpError(502, "Quote signature verification failed");
  }
  // The signature covers the echoed request, so these checks pin the quote to what we asked for.
  // Case-insensitive because 1Click may normalize hex/bech32 casing.
  const echoed = response.quoteRequest;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (
    !same(echoed.recipient, p.recipient) ||
    echoed.destinationAsset !== p.destinationAsset ||
    echoed.originAsset !== p.originAsset ||
    !same(echoed.refundTo, p.refundTo)
  ) {
    throw new HttpError(502, "Quote does not match the request");
  }
  if (!p.dry && !response.quote.depositAddress) {
    throw new HttpError(502, "Quote is missing a deposit address");
  }
  return response;
}

export async function getStatus(depositAddress: string, depositMemo?: string | null) {
  try {
    return await OneClickService.getExecutionStatus(depositAddress, depositMemo ?? undefined);
  } catch (err) {
    throw toHttpError(err, "Couldn't fetch swap status");
  }
}

export async function submitDepositTx(depositAddress: string, txHash: string, memo?: string | null) {
  try {
    return await OneClickService.submitDepositTx({ depositAddress, txHash, memo: memo ?? undefined });
  } catch (err) {
    throw toHttpError(err, "Couldn't submit the deposit transaction");
  }
}

function toHttpError(err: unknown, fallback: string): HttpError {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string } | undefined;
    const message = body?.message ?? err.message ?? fallback;
    // 1Click answers 4xx for invalid input (bad address, amount too low, no route); pass it through.
    const status = err.status >= 400 && err.status < 500 ? 400 : 502;
    const min = message.match(/try at least (\d+)/);
    return new HttpError(status, humanize(message), min ? { minBaseUnits: min[1] } : undefined);
  }
  return new HttpError(502, fallback);
}

// Upstream wording that would reveal the routing provider to payers (its name, asset ids, API).
const PROVIDER_TERMS = /intents|1click|one-?click|defuse|nep\d+:|omft|\.near\b/i;

function humanize(message: string): string {
  if (/Amount is too low/i.test(message)) return "Amount is below the bridge minimum for this route.";
  if (/refundTo is not valid/i.test(message)) return "That refund address isn't valid for the selected chain.";
  if (/recipient is not valid/i.test(message)) return "That recipient address isn't valid for the selected chain.";
  if (/Failed to get quote|Quoting for this pair is not available/i.test(message)) return "No route available for this pair right now. Try another token.";
  // Kept verbatim: requestQuote retries in MEMO mode when it sees this, and the payer never does.
  if (/Incorrect depositMode/i.test(message)) return message;
  if (PROVIDER_TERMS.test(message)) return "The swap network couldn't process this request. Try again, or pick another token.";
  return message;
}
