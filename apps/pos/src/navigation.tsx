import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Sale } from './api/types';
import type { Direction } from './components/motion';

/** A small in-memory stack navigator — enough for a single-task POS. */

export type Route =
  | { name: 'home' }
  | { name: 'newSale' }
  | { name: 'payment'; id: string; initial?: Sale }
  | { name: 'sales' }
  | { name: 'settings' };

interface Nav {
  route: Route;
  /** How many screens deep we are, and which way we just moved (for transitions). */
  depth: number;
  direction: Direction;
  push(r: Route): void;
  pop(): void;
  /** Replace the whole stack (e.g. after finishing a flow). */
  reset(r?: Route): void;
  replace(r: Route): void;
}

const Ctx = createContext<Nav | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const direction = useRef<Direction>('swap');

  const push = useCallback((r: Route) => {
    direction.current = 'push';
    setStack((s) => [...s, r]);
  }, []);
  const pop = useCallback(() => {
    direction.current = 'pop';
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const reset = useCallback((r?: Route) => {
    direction.current = r && r.name !== 'home' ? 'swap' : 'pop';
    setStack(r && r.name !== 'home' ? [{ name: 'home' }, r] : [{ name: 'home' }]);
  }, []);
  const replace = useCallback((r: Route) => {
    direction.current = 'swap';
    setStack((s) => [...s.slice(0, -1), r]);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  const value = useMemo(
    () => ({ route: stack[stack.length - 1], depth: stack.length, direction: direction.current, push, pop, reset, replace }),
    [stack, push, pop, reset, replace]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): Nav {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside NavigationProvider');
  return v;
}
