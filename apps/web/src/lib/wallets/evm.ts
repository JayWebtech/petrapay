"use client";

import { createWalletClient, custom, erc20Abi, getAddress, numberToHex, type Address, type Chain, type EIP1193Provider } from "viem";
import { abstract, arbitrum, avalanche, base, berachain, bsc, gnosis, mainnet, monad, optimism, plasma, polygon, scroll, xLayer } from "viem/chains";

const CHAINS: Record<number, Chain> = Object.fromEntries(
  [mainnet, base, arbitrum, optimism, polygon, bsc, avalanche, gnosis, berachain, scroll, monad, xLayer, plasma, abstract].map((c) => [c.id, c]),
);

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function hasEvmWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

function provider(): EIP1193Provider {
  if (!window.ethereum) throw new Error("No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet, or send manually.");
  return window.ethereum;
}

export async function connectEvm(): Promise<Address> {
  const accounts = (await provider().request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0];
  if (!account) throw new Error("Wallet returned no accounts");
  return getAddress(account);
}

async function ensureChain(chainId: number) {
  const p = provider();
  const current = (await p.request({ method: "eth_chainId" })) as string;
  if (parseInt(current, 16) === chainId) return;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(chainId) }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    const chain = CHAINS[chainId];
    // 4902: the wallet doesn't know this chain yet.
    if (code !== 4902 || !chain) throw err;
    await p.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: numberToHex(chainId),
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [...chain.rpcUrls.default.http],
          blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
        },
      ],
    });
  }
}

/** Sends `amount` (base units) of a native coin or ERC-20 to `to`. Returns the transaction hash. */
export async function payWithEvm(args: { chainId: number; to: string; amount: bigint; tokenAddress?: string }): Promise<string> {
  const account = await connectEvm();
  await ensureChain(args.chainId);
  const client = createWalletClient({ account, chain: CHAINS[args.chainId], transport: custom(provider()) });
  if (args.tokenAddress) {
    return client.writeContract({
      address: getAddress(args.tokenAddress),
      abi: erc20Abi,
      functionName: "transfer",
      args: [getAddress(args.to), args.amount],
    });
  }
  return client.sendTransaction({ to: getAddress(args.to), value: args.amount });
}

/** EIP-681 payment URI so mobile wallets can scan the checkout QR. */
export function evmPaymentUri(args: { chainId: number; to: string; amount: string; tokenAddress?: string }): string {
  if (args.tokenAddress) {
    return `ethereum:${args.tokenAddress}@${args.chainId}/transfer?address=${args.to}&uint256=${args.amount}`;
  }
  return `ethereum:${args.to}@${args.chainId}?value=${args.amount}`;
}
