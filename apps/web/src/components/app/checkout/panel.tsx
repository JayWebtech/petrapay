"use client";

import { ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { TokenIcon } from "@/components/app/token-icon";
import panelImage from "../../../../public/bg-1.png";

const STICKERS: [string, string][] = [
  ["USDC", "base"],
  ["SOL", "sol"],
  ["ETH", "eth"],
];

/**
 * Left side of every checkout: who is asking, and a white card with what for.
 * On desktop the artwork fills the column; stacked on smaller screens it shrinks to a frame
 * around the card so the payment form starts near the top of the screen.
 */
export function CheckoutPanel({ creatorName, children }: { creatorName: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <aside className="relative isolate flex flex-col overflow-hidden rounded-[24px] bg-[#2f63c4] p-3 sm:rounded-[28px] sm:p-5 lg:h-full lg:rounded-[40px] lg:p-12">
      <Image src={panelImage} alt="" fill priority placeholder="blur" sizes="(min-width: 1024px) 52vw, 100vw" className="-z-20 object-cover" />
      {/* A soft shade at the foot of the art keeps the trust line legible over the sea and viaduct. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 hidden h-1/3 bg-gradient-to-t from-[#0b2350]/65 to-transparent lg:block" />

      <div className="flex w-fit items-center gap-2 rounded-full bg-white/85 py-1 pr-3.5 pl-1 shadow-[0_8px_24px_-12px_rgba(17,15,36,0.35)] ring-1 ring-black/5 backdrop-blur-md lg:gap-2.5 lg:py-1.5 lg:pr-4 lg:pl-1.5">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-white lg:size-9">
          {creatorName.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-sm font-semibold tracking-tight lg:text-[15px]">{creatorName}</span>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-3 max-w-lg sm:mt-8 lg:mt-12"
      >
        {/* Token "stickers" perched on the card edge */}
        <div className="absolute -top-5 right-5 z-10 hidden items-center sm:flex">
          {STICKERS.map(([symbol, chain], i) => (
            <span key={symbol} className="icon-tile -ml-2 size-11 rounded-2xl first:ml-0" style={{ transform: `rotate(${(i - 1) * 6}deg)` }}>
              <TokenIcon symbol={symbol} chain={chain} size={26} />
            </span>
          ))}
        </div>

        <div className="rounded-[20px] bg-white/92 p-4 shadow-[0_30px_70px_-30px_rgba(11,35,80,0.55)] ring-1 ring-black/[0.04] backdrop-blur-md sm:rounded-[28px] sm:p-7">
          {children}
        </div>
      </motion.div>

      <p className="mt-auto hidden items-center gap-2 pt-10 text-sm font-medium text-white [text-shadow:0_1px_8px_rgba(11,35,80,0.5)] lg:flex">
        <ShieldCheck className="size-4" />
        Settles privately to a shielded Zcash address.
      </p>
    </aside>
  );
}
