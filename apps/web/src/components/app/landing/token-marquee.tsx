"use client";

import { chainMeta } from "@petrapay/shared";
import { Marquee } from "@/components/motion/marquee";
import { NumberTicker } from "@/components/motion/number-ticker";
import { TokenIcon } from "../token-icon";
import { Reveal } from "./reveal";

export type MarqueeToken = { symbol: string; chain: string };

function Pill({ token }: { token: MarqueeToken }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-white py-1.5 pr-4 pl-1.5 shadow-[0_1px_2px_rgba(17,15,36,0.04)]">
      <TokenIcon symbol={token.symbol} chain={token.chain} size={28} />
      <span className="text-sm font-medium">{token.symbol}</span>
      <span className="text-xs text-muted-foreground">{chainMeta(token.chain).name}</span>
    </span>
  );
}

/** The real list of payable tokens, scrolling in two directions. */
export function TokenMarquee({ tokens, tokenCount, chainCount }: { tokens: MarqueeToken[]; tokenCount: number; chainCount: number }) {
  const half = Math.ceil(tokens.length / 2);
  return (
    <section className="py-20 md:py-28">
      <Reveal className="mx-auto max-w-3xl px-5 text-center">
        <p className="text-sm font-medium text-muted-foreground">Your client pays with what they already hold</p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
          <NumberTicker value={tokenCount} suffix="+" className="text-primary" />
          <span>tokens across</span>
          <NumberTicker value={chainCount} className="text-primary" />
          <span>chains</span>
        </p>
      </Reveal>
      <div className="mt-12 space-y-4">
        <Marquee speed={40} gap="0.75rem">
          {tokens.slice(0, half).map((t) => (
            <Pill key={`${t.symbol}-${t.chain}`} token={t} />
          ))}
        </Marquee>
        <Marquee speed={34} direction="right" gap="0.75rem">
          {tokens.slice(half).map((t) => (
            <Pill key={`${t.symbol}-${t.chain}`} token={t} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
