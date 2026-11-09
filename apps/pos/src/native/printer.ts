import { NativeModules } from 'react-native';

/** One line-level instruction for the thermal printer (see PetraPrinterModule.kt). */
export type PrintOp =
  | { type: 'text'; text: string; align?: 'left' | 'center' | 'right'; size?: number; bold?: boolean }
  | {
      type: 'columns';
      texts: string[];
      weights?: number[];
      aligns?: ('left' | 'center' | 'right')[];
      size?: number;
      bold?: boolean;
    }
  | { type: 'qr'; data: string; moduleSize?: number; errorLevel?: 0 | 1 | 2 | 3 }
  | { type: 'divider'; width?: number }
  | { type: 'feed'; lines: number };

interface NativePrinter {
  isAvailable(): Promise<boolean>;
  print(ops: PrintOp[]): Promise<null>;
}

const native = NativeModules.PetraPrinter as NativePrinter | undefined;

let availability: Promise<boolean> | null = null;

export const printer = {
  /** Whether this device has a reachable receipt printer (cached after the first check). */
  isAvailable(): Promise<boolean> {
    if (!native) return Promise.resolve(false);
    if (!availability) availability = native.isAvailable().catch(() => false);
    return availability;
  },

  async print(ops: PrintOp[]): Promise<void> {
    if (!native) throw new Error('No receipt printer found on this device.');
    try {
      await native.print(ops);
    } catch (e) {
      availability = null; // re-check next time (service may have restarted)
      throw e;
    }
  },
};
