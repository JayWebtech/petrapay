"use client";

import { Lock, Zap } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { DynamicIsland, DynamicIslandView } from "@/components/motion/dynamic-island";
import { Loader } from "@/components/motion/loader";
import { TokenIcon } from "../token-icon";

const SEQUENCE: (string | null)[] = [null, "detected", "swapping", "shielded"];
const DWELL_MS = [1600, 2200, 2200, 2600];

/** A payment's life in one pill: detected on Base, swapped by solvers, landed shielded. Loops. */
export function PaymentIsland() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 3 : 0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % SEQUENCE.length), DWELL_MS[step]);
    return () => window.clearTimeout(id);
  }, [step, reduce]);

  return (
    <div className="flex h-[76px] items-start justify-center" aria-label="Example payment progressing from Base to shielded ZEC">
      <DynamicIsland
        view={SEQUENCE[step] ?? null}
        className="bg-[#07091f] text-white ring-1 ring-white/10"
        compact={
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-[#9bf0c3]" />
            <span>Invoice #042 · $1,250</span>
          </>
        }
      >
        <DynamicIslandView id="detected" className="gap-3 py-2.5 pr-5 pl-2.5">
          <TokenIcon symbol="USDC" chain="base" size={32} />
          <div className="flex flex-col text-left whitespace-nowrap">
            <span className="text-[10px] tracking-wider uppercase opacity-60">Payment detected</span>
            <span className="text-sm font-semibold tabular">1,262.41 USDC on Base</span>
          </div>
        </DynamicIslandView>

        <DynamicIslandView id="swapping" className="gap-3 py-2.5 pr-5 pl-3">
          <span className="grid size-8 place-items-center rounded-full bg-white/10">
            <Loader variant="spinner" size={16} className="text-[#c9c1ff]" />
          </span>
          <div className="flex flex-col text-left whitespace-nowrap">
            <span className="text-[10px] tracking-wider uppercase opacity-60">Smart routing</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Zap className="size-3.5 text-[#c9c1ff]" /> Solvers swapping to ZEC
            </span>
          </div>
        </DynamicIslandView>

        <DynamicIslandView id="shielded" className="gap-3 py-2.5 pr-5 pl-3">
          <span className="grid size-8 place-items-center rounded-full bg-[#f5deb0] text-[#1b1440]">
            <Lock className="size-4" />
          </span>
          <div className="flex flex-col text-left whitespace-nowrap">
            <span className="text-[10px] tracking-wider uppercase opacity-60">Shielded · Orchard</span>
            <span className="text-sm font-semibold text-[#f5deb0] tabular">+0.8474 ZEC received</span>
          </div>
        </DynamicIslandView>
      </DynamicIsland>
    </div>
  );
}
