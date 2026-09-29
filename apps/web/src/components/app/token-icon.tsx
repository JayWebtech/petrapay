"use client";

import { chainMeta } from "@petrapay/shared";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Maps token symbol → cryptologos.cc slug.
 * https://cryptologos.cc/  (SVG logos, free CDN)
 */
const LOGO_SLUGS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  WETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  SOL: "solana",
  BNB: "bnb",
  DAI: "multi-collateral-dai",
  NEAR: "near-protocol",
  wNEAR: "near-protocol",
  ZEC: "zcash",
  AVAX: "avalanche",
  MATIC: "polygon",
  POL: "polygon",
  ARB: "arbitrum",
  OP: "optimism",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  DOT: "polkadot",
  ADA: "cardano",
  ATOM: "cosmos",
  XRP: "xrp",
  LTC: "litecoin",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  FTM: "fantom",
  CRV: "curve-dao-token",
  SNX: "synthetix",
  MKR: "maker",
  COMP: "compound",
  YFI: "yearn-finance",
  SUSHI: "sushiswap",
  GRT: "the-graph",
  LDO: "lido-dao",
  SAND: "the-sandbox",
  MANA: "decentraland",
  APE: "apecoin",
  FIL: "filecoin",
  ICP: "internet-computer",
  FLOW: "flow",
  XTZ: "tezos",
  ALGO: "algorand",
  VET: "vechain",
  XLM: "stellar",
  TRX: "tron",
  TON: "toncoin",
  SUI: "sui",
  APT: "aptos",
  INJ: "injective-protocol",
};

const SYMBOL_COLORS: Record<string, string> = {
  USDC: "#2775CA",
  USDT: "#26A17B",
  ETH: "#627EEA",
  WETH: "#627EEA",
  SOL: "#9945FF",
  BTC: "#F7931A",
  ZEC: "#F4B728",
  NEAR: "#00C08B",
  wNEAR: "#00C08B",
  DAI: "#F5AC37",
  BNB: "#F0B90B",
};

function colorFor(symbol: string) {
  if (SYMBOL_COLORS[symbol]) return SYMBOL_COLORS[symbol];
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 50%)`;
}

function logoUrl(symbol: string) {
  const slug = LOGO_SLUGS[symbol];
  if (!slug) return null;
  const ticker = symbol.toLowerCase().replace(/^w/, "");
  return `https://cryptologos.cc/logos/${slug}-${ticker}-logo.svg?v=040`;
}

export function TokenIcon({
  symbol,
  chain,
  size = 32,
  className,
}: {
  symbol: string;
  chain?: string;
  size?: number;
  className?: string;
}) {
  const meta = chain ? chainMeta(chain) : null;
  const text = symbol.replace(/^\$/, "").slice(0, 4);
  const src = logoUrl(symbol);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {src && !imgFailed ? (
        <span className="grid size-full place-items-center rounded-full bg-white ring-1 ring-black/5 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={symbol}
            width={size}
            height={size}
            onError={() => setImgFailed(true)}
            className="size-full object-contain p-0.5"
          />
        </span>
      ) : (
        <span
          className="grid size-full place-items-center rounded-full font-semibold text-white"
          style={{
            background: colorFor(symbol),
            fontSize: Math.max(7, size * (text.length > 3 ? 0.25 : 0.32)),
          }}
        >
          {text}
        </span>
      )}

      {meta ? (
        <span
          title={meta.name}
          className="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-card"
          style={{
            width: size * 0.42,
            height: size * 0.42,
            background: meta.color,
          }}
        />
      ) : null}
    </span>
  );
}

export function ChainPill({ chain, className }: { chain: string; className?: string }) {
  const meta = chainMeta(chain);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.name}
    </span>
  );
}
