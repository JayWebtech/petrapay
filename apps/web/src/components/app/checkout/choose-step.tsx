"use client";

import { chainMeta, type TokenDTO } from "@petrapay/shared";
import { ChevronRight, Lock, Wallet } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { popularTokens } from "@/components/app/token-selector";
import { TokenIcon } from "@/components/app/token-icon";
import { Loader } from "@/components/motion/loader";
import { OrDivider, StepHeader, estimateIn } from "./utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** How would you like to pay? Popular tokens up front, the full list a tap away, shielded ZEC below. */
export function ChooseStep({
  payee,
  usd,
  tokens,
  onPick,
  onBrowse,
  onZec,
  onBack,
  zecPending = false,
}: {
  payee: string;
  /** What's being paid, in USD, for the per-token estimates. */
  usd: number | null;
  tokens: TokenDTO[] | null;
  onPick: (token: TokenDTO) => void;
  onBrowse: () => void;
  onZec: () => void;
  onBack?: () => void;
  zecPending?: boolean;
}) {
  const reduce = useReducedMotion();
  const quick = tokens ? popularTokens(tokens, [], 3) : [];
  // Distinct symbols for the "browse" avatars, so the stack reads as variety.
  const more = tokens
    ? popularTokens(
        tokens,
        quick.map((t) => t.assetId),
      )
        .filter((t, i, all) => all.findIndex((x) => x.symbol === t.symbol) === i && !quick.some((q) => q.symbol === t.symbol))
        .slice(0, 4)
    : [];

  return (
    <div>
      <StepHeader
        onBack={onBack}
        icon={<Wallet className="size-6 text-foreground" />}
        title={`Pay ${payee}`}
        body="Use any token you already hold. You'll see the exact amount, fees included, before anything is sent."
      />

      <div className="mt-8 space-y-3">
        {tokens
          ? quick.map((t, i) => (
              <motion.button
                key={t.assetId}
                type="button"
                onClick={() => onPick(t)}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * i, ease: EASE }}
                className="btn-soft group h-16 w-full justify-between px-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <TokenIcon symbol={t.symbol} chain={t.blockchain} size={34} />
                  <span>
                    <span className="block text-[15px] font-semibold">{t.symbol}</span>
                    <span className="block text-xs text-muted-foreground">on {chainMeta(t.blockchain).name}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground tabular">
                  {estimateIn(t, usd)}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.button>
            ))
          : [0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}

        <button type="button" onClick={onBrowse} disabled={!tokens} className="btn-soft group h-14 w-full justify-between px-4">
          <span className="flex items-center gap-3">
            <span className="flex -space-x-2">
              {more.map((t) => (
                <TokenIcon key={t.assetId} symbol={t.symbol} chain={t.blockchain} size={26} className="rounded-full ring-2 ring-white" />
              ))}
            </span>
            <span className="text-[15px] font-medium">Browse {tokens ? `${Math.floor(tokens.length / 10) * 10}+` : "all"} tokens</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="my-6">
        <OrDivider>or pay privately</OrDivider>
      </div>

      <button type="button" onClick={onZec} disabled={zecPending} className="btn-soft group h-14 w-full justify-between px-4">
        <span className="flex items-center gap-3">
          {zecPending ? (
            <span className="grid size-7 place-items-center">
              <Loader variant="spinner" size={16} />
            </span>
          ) : (
            <TokenIcon symbol="ZEC" chain="zec" size={28} />
          )}
          <span className="text-[15px] font-medium whitespace-nowrap">Pay with shielded ZEC</span>
        </span>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Lock className="size-3.5" /> Zashi & Orchard wallets
        </span>
      </button>

      <p className="mt-10 text-center text-xs leading-relaxed text-muted-foreground">
        Every quote is signed and fully refundable to your own address if it can&apos;t complete. PetraPay never holds your funds.
      </p>
    </div>
  );
}
