import type { Me, Sale } from '../api/types';
import type { PrintOp } from '../native/printer';
import { deviceName } from '../native/device';
import { chainName, fullTime, money, saleRef } from './format';

/**
 * Receipt layouts for the 58 mm thermal printer (~32 characters a line at the
 * default size). Every figure comes from the server's view of the sale. Nothing
 * that could link the merchant's payments is printed: no addresses, no keys.
 */

const WIDTH = 32;

const short = (hash: string) => (hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash);

/** Amounts with currency codes, not symbols: the printer font may lack some. */
const amount = (value: string | number, currency: 'USD' | 'ZEC') =>
  currency === 'USD' ? `USD ${Number(value).toFixed(2)}` : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 8 })} ZEC`;

const row = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}): PrintOp => ({
  type: 'columns',
  texts: [label, value],
  weights: [2, 3],
  aligns: ['left', 'right'],
  ...opts,
});

function header(me: Me, title: string): PrintOp[] {
  return [
    { type: 'text', text: me.merchantName, align: 'center', bold: true, size: 32 },
    { type: 'feed', lines: 1 },
    { type: 'text', text: title, align: 'center', bold: true, size: 26 },
    { type: 'divider', width: WIDTH },
  ];
}

/** Receipt for a paid sale. The merchant copy adds what settled to the shielded wallet. */
export function saleReceipt(sale: Sale, me: Me, copy: 'customer' | 'merchant' = 'customer'): PrintOp[] {
  const ops = header(me, copy === 'merchant' ? 'MERCHANT COPY' : 'PAYMENT RECEIPT');
  if (sale.testMode) ops.push({ type: 'text', text: '*** TEST - NOT A REAL PAYMENT ***', align: 'center', bold: true });

  ops.push(row('Sale', saleRef(sale.number)), row('Date', fullTime(sale.paidAt ?? sale.createdAt)));
  if (sale.note && sale.note !== 'In-store payment') ops.push(row('Item', sale.note));
  ops.push({ type: 'divider', width: WIDTH });

  ops.push(row('TOTAL', amount(sale.amount, sale.currency), { bold: true, size: 28 }));
  if (sale.testMode && !sale.paidWith) {
    ops.push(row('Paid with', 'Simulated'));
  } else if (sale.paidWith) {
    ops.push(row('Paid with', `${Number(sale.paidWith.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${sale.paidWith.symbol}`));
    ops.push(row('Network', chainName(sale.paidWith.chain)));
  } else {
    ops.push(row('Paid with', 'Shielded ZEC'));
  }
  ops.push(row('Status', sale.testMode ? 'PAID (TEST)' : 'PAID', { bold: true }));

  if (copy === 'merchant' && sale.received) {
    ops.push({ type: 'divider', width: WIDTH }, row('Received', amount(sale.received.zec, 'ZEC'), { bold: true }));
    ops.push({ type: 'text', text: 'Settled to a fresh shielded address.', size: 20 });
  }

  ops.push({ type: 'divider', width: WIDTH });
  if (sale.txHash) ops.push({ type: 'text', text: `Tx ${short(sale.txHash)}`, size: 20 });
  ops.push(
    { type: 'qr', data: sale.checkoutUrl, moduleSize: 5, errorLevel: 1 },
    { type: 'text', text: 'Scan for your online receipt', align: 'center', size: 20 },
    { type: 'feed', lines: 1 },
    { type: 'text', text: copy === 'merchant' ? 'Keep for your records' : 'Thank you!', align: 'center', bold: true },
    { type: 'text', text: 'Paid privately with PetraPay', align: 'center', size: 20 },
    { type: 'feed', lines: 4 }
  );
  return ops;
}

/** A short page to confirm the printer works and the layout fits the paper. */
export function testPage(me: Me): PrintOp[] {
  return [
    ...header(me, 'PRINTER TEST'),
    row('Terminal', me.deviceName || deviceName),
    row('Date', fullTime(new Date().toISOString())),
    row('Amount', money('12.5', 'USD').replace('$', 'USD ')),
    row('Paid with', '12.53 USDC'),
    { type: 'divider', width: WIDTH },
    { type: 'text', text: 'If you can read this and scan the code below, receipts are ready.', size: 20 },
    { type: 'qr', data: 'PETRAPAY-PRINTER-TEST', moduleSize: 5 },
    { type: 'feed', lines: 4 },
  ];
}
