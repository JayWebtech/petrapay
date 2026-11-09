import type { Currency } from '../api/types';

export function money(amount: string | number, currency: Currency): string {
  const n = Number(amount);
  if (currency === 'USD') {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 8 })} ZEC`;
}

/** Decimal places the keypad allows for each currency. */
export const DECIMALS: Record<Currency, number> = { USD: 2, ZEC: 8 };

/** Smallest charge the server accepts. */
export const MINIMUM: Record<Currency, number> = { USD: 1, ZEC: 0.001 };

/** An amount as it's being typed at the till: grouped, keeping a trailing "." or ".5". */
export function typedAmount(raw: string, currency: Currency): string {
  const [whole, frac] = (raw || '0').split('.');
  const grouped = Number(whole).toLocaleString('en-US');
  const body = `${grouped}${frac !== undefined ? `.${frac}` : ''}`;
  return currency === 'USD' ? `$${body}` : `${body} ZEC`;
}

/** mm:ss until `iso`, or null once it has passed. */
export function countdown(iso: string, now = Date.now()): string | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

export function fullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Sale number as printed and shown: #0042. */
export const saleRef = (n: number) => `#${String(n).padStart(4, '0')}`;

const CHAINS: Record<string, string> = {
  base: 'Base',
  eth: 'Ethereum',
  arb: 'Arbitrum',
  op: 'Optimism',
  pol: 'Polygon',
  bsc: 'BNB Chain',
  avax: 'Avalanche',
  sol: 'Solana',
  btc: 'Bitcoin',
  near: 'NEAR',
  ton: 'TON',
  tron: 'Tron',
  doge: 'Dogecoin',
  xrp: 'XRP Ledger',
  stellar: 'Stellar',
  sui: 'Sui',
  zec: 'Zcash',
};

export function chainName(chain: string): string {
  return CHAINS[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

/** Idempotency keys only need to be unique per terminal; Math.random is fine (Hermes has no crypto.getRandomValues). */
export function newKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
