/**
 * Display metadata for the `blockchain` codes returned by the 1Click `/v0/tokens` endpoint.
 * Unknown codes fall back to a title-cased name, so new chains show up without a code change.
 */

export type WalletFamily = "evm" | "solana";

export type ChainMeta = {
  id: string;
  name: string;
  color: string;
  /** EVM chain id, when payers can pay with an injected EVM wallet. */
  evmChainId?: number;
  wallet?: WalletFamily;
  /** Chains with slow finality get a longer quote deadline. */
  slow?: boolean;
  addressHint: string;
  /** Lower sorts first in pickers. */
  rank: number;
};

const CHAINS: Record<string, Omit<ChainMeta, "id">> = {
  base: { name: "Base", color: "#0052FF", evmChainId: 8453, wallet: "evm", addressHint: "0x…", rank: 1 },
  sol: { name: "Solana", color: "#9945FF", wallet: "solana", addressHint: "Base58 address", rank: 2 },
  eth: { name: "Ethereum", color: "#627EEA", evmChainId: 1, wallet: "evm", addressHint: "0x…", rank: 3 },
  arb: { name: "Arbitrum", color: "#28A0F0", evmChainId: 42161, wallet: "evm", addressHint: "0x…", rank: 4 },
  op: { name: "Optimism", color: "#FF0420", evmChainId: 10, wallet: "evm", addressHint: "0x…", rank: 5 },
  pol: { name: "Polygon", color: "#8247E5", evmChainId: 137, wallet: "evm", addressHint: "0x…", rank: 6 },
  bsc: { name: "BNB Chain", color: "#F0B90B", evmChainId: 56, wallet: "evm", addressHint: "0x…", rank: 7 },
  avax: { name: "Avalanche", color: "#E84142", evmChainId: 43114, wallet: "evm", addressHint: "0x…", rank: 8 },
  near: { name: "NEAR", color: "#00C08B", addressHint: "name.near or implicit account", rank: 9 },
  btc: { name: "Bitcoin", color: "#F7931A", slow: true, addressHint: "bc1…", rank: 10 },
  tron: { name: "Tron", color: "#FF060A", addressHint: "T…", rank: 11 },
  ton: { name: "TON", color: "#0098EA", addressHint: "UQ… / EQ…", rank: 12 },
  sui: { name: "Sui", color: "#4DA2FF", addressHint: "0x…", rank: 13 },
  aptos: { name: "Aptos", color: "#2DD8A7", addressHint: "0x…", rank: 14 },
  gnosis: { name: "Gnosis", color: "#04795B", evmChainId: 100, wallet: "evm", addressHint: "0x…", rank: 15 },
  bera: { name: "Berachain", color: "#814625", evmChainId: 80094, wallet: "evm", addressHint: "0x…", rank: 16 },
  scroll: { name: "Scroll", color: "#EBC28E", evmChainId: 534352, wallet: "evm", addressHint: "0x…", rank: 17 },
  monad: { name: "Monad", color: "#836EF9", evmChainId: 143, wallet: "evm", addressHint: "0x…", rank: 18 },
  xlayer: { name: "X Layer", color: "#A0A0A0", evmChainId: 196, wallet: "evm", addressHint: "0x…", rank: 19 },
  plasma: { name: "Plasma", color: "#1A1A1A", evmChainId: 9745, wallet: "evm", addressHint: "0x…", rank: 20 },
  abs: { name: "Abstract", color: "#00DB7F", evmChainId: 2741, wallet: "evm", addressHint: "0x…", rank: 21 },
  stellar: { name: "Stellar", color: "#7D00FF", addressHint: "G…", rank: 22 },
  starknet: { name: "Starknet", color: "#EC796B", addressHint: "0x…", rank: 23 },
  xrp: { name: "XRP Ledger", color: "#23292F", addressHint: "r…", rank: 24 },
  ltc: { name: "Litecoin", color: "#345D9D", slow: true, addressHint: "ltc1… / L… / M…", rank: 25 },
  doge: { name: "Dogecoin", color: "#C2A633", slow: true, addressHint: "D…", rank: 26 },
  bch: { name: "Bitcoin Cash", color: "#0AC18E", slow: true, addressHint: "bitcoincash:… / 1…", rank: 27 },
  dash: { name: "Dash", color: "#008DE4", slow: true, addressHint: "X…", rank: 28 },
  cardano: { name: "Cardano", color: "#0033AD", slow: true, addressHint: "addr1…", rank: 29 },
  zec: { name: "Zcash", color: "#F4B728", slow: true, addressHint: "u1… (shielded) or t1…", rank: 30 },
  hypercore: { name: "Hyperliquid", color: "#97FCE4", addressHint: "0x…", rank: 31 },
  movement: { name: "Movement", color: "#F5C400", addressHint: "0x…", rank: 32 },
  aleo: { name: "Aleo", color: "#00C0F9", addressHint: "aleo1…", rank: 33 },
  fogo: { name: "Fogo", color: "#FF5A1F", addressHint: "Base58 address", rank: 34 },
};

export function chainMeta(id: string): ChainMeta {
  const known = CHAINS[id];
  if (known) return { id, ...known };
  return { id, name: id.charAt(0).toUpperCase() + id.slice(1), color: "#71717A", addressHint: "Address", rank: 100 };
}

/** Deadline for a new quote. Long enough for the payer to send and for slow chains to confirm. */
export function quoteDeadline(originChain: string, now = Date.now()): Date {
  const minutes = chainMeta(originChain).slow ? 180 : 60;
  return new Date(now + minutes * 60_000);
}

export const ZEC_ASSET_ID = "nep141:zec.omft.near";
