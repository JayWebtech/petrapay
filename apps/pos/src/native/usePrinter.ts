import { useCallback, useEffect, useRef, useState } from 'react';
import { printer, PrintOp } from './printer';

/** Printer availability plus a print action with busy/error state for a screen. */
export function usePrinter() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    printer.isAvailable().then((a) => mounted.current && setAvailable(a));
    return () => {
      mounted.current = false;
    };
  }, []);

  const print = useCallback(async (ops: PrintOp[]) => {
    setPrinting(true);
    setError(null);
    try {
      await printer.print(ops);
      return true;
    } catch (e) {
      if (mounted.current) setError((e as Error).message || 'Printing failed.');
      return false;
    } finally {
      if (mounted.current) setPrinting(false);
    }
  }, []);

  return { available, printing, error, print };
}
