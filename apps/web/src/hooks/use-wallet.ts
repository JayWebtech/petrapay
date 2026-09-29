"use client";

import type { WalletFamily } from "@petrapay/shared";
import { useSyncExternalStore } from "react";
import { hasEvmWallet } from "@/lib/wallets/evm";
import { hasSolanaWallet } from "@/lib/wallets/solana";

const noopSubscribe = () => () => {};

/** Whether a browser wallet for this chain family is injected. Always false during SSR. */
export function useWalletAvailable(family: WalletFamily | undefined): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => (family === "evm" ? hasEvmWallet() : family === "solana" ? hasSolanaWallet() : false),
    () => false,
  );
}
