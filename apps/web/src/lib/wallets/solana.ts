"use client";

import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type SolanaProvider = {
  publicKey?: PublicKey | null;
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string } | string>;
};

declare global {
  interface Window {
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
    solana?: SolanaProvider;
  }
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function provider(): SolanaProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.phantom?.solana ?? window.solflare ?? window.backpack ?? window.solana;
}

export function hasSolanaWallet(): boolean {
  return !!provider();
}

export async function connectSolana(): Promise<string> {
  const p = provider();
  if (!p) throw new Error("No Solana wallet found. Install Phantom, Solflare or Backpack, or send manually.");
  const { publicKey } = await p.connect();
  return publicKey.toBase58();
}

/** Sends SOL or an SPL token (classic or Token-2022) to the deposit address. Returns the signature. */
export async function payWithSolana(args: { to: string; amount: bigint; mint?: string; decimals: number }): Promise<string> {
  const p = provider();
  if (!p) throw new Error("No Solana wallet found");
  const { publicKey: payer } = await p.connect();
  const connection = new Connection(RPC_URL, "confirmed");
  const to = new PublicKey(args.to);
  const tx = new Transaction();

  if (!args.mint) {
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: to, lamports: args.amount }));
  } else {
    const mint = new PublicKey(args.mint);
    const mintInfo = await connection.getAccountInfo(mint);
    if (!mintInfo) throw new Error("Token mint not found on Solana");
    const programId = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const fromAta = getAssociatedTokenAddressSync(mint, payer, false, programId);
    const toAta = getAssociatedTokenAddressSync(mint, to, true, programId);
    tx.add(
      // The deposit address may not have a token account yet; the payer funds its creation.
      createAssociatedTokenAccountIdempotentInstruction(payer, toAta, to, mint, programId),
      createTransferCheckedInstruction(fromAta, mint, toAta, payer, args.amount, args.decimals, [], programId),
    );
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  const result = await p.signAndSendTransaction(tx);
  return typeof result === "string" ? result : result.signature;
}

/** Solana Pay URI for wallet QR scanning. */
export function solanaPaymentUri(args: { to: string; amountFormatted: string; mint?: string }): string {
  const params = new URLSearchParams({ amount: args.amountFormatted });
  if (args.mint) params.set("spl-token", args.mint);
  return `solana:${args.to}?${params.toString()}`;
}
