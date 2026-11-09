import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, forgetPairing, onTerminalRemoved, restorePairing } from '../api/client';
import type { Currency, Me } from '../api/types';
import { secureStore } from '../native/secureStore';

/**
 * Whether this terminal is paired, plus its till preferences. Pairing lasts
 * until the merchant removes the terminal from the dashboard or unpairs it here.
 */

export interface Preferences {
  currency: Currency;
  autoPrint: boolean;
}

const DEFAULT_PREFS: Preferences = { currency: 'USD', autoPrint: true };
const PREFS_KEY = 'pos_prefs';

type State =
  | { status: 'starting' }
  | { status: 'offline' }
  | { status: 'unpaired'; reason?: string }
  | { status: 'ready'; me: Me };

interface SessionApi {
  state: State;
  prefs: Preferences;
  setPrefs(next: Partial<Preferences>): void;
  pair(code: string, deviceName: string, server: string): Promise<void>;
  unpair(): Promise<void>;
  retry(): Promise<void>;
  reload(): Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'starting' });
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULT_PREFS);

  const unpairLocally = useCallback(async (reason?: string) => {
    await forgetPairing();
    setState({ status: 'unpaired', reason });
  }, []);

  useEffect(() => onTerminalRemoved((reason) => void unpairLocally(reason)), [unpairLocally]);

  const resume = useCallback(async () => {
    const [paired, saved] = await Promise.all([restorePairing(), secureStore.get(PREFS_KEY)]);
    if (saved) {
      try {
        setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
      } catch {
        // Ignore a corrupt preferences blob.
      }
    }
    if (!paired) return setState({ status: 'unpaired' });
    try {
      setState({ status: 'ready', me: await api.me() });
    } catch (e) {
      if ((e as ApiError).status === 401) return; // onTerminalRemoved already moved us to unpaired
      setState({ status: 'offline' });
    }
  }, []);

  useEffect(() => {
    resume();
  }, [resume]);

  const setPrefs = useCallback((next: Partial<Preferences>) => {
    setPrefsState((p) => {
      const merged = { ...p, ...next };
      void secureStore.set(PREFS_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const pair = useCallback(async (code: string, deviceName: string, server: string) => {
    await api.pair(code, deviceName, server);
    setState({ status: 'ready', me: await api.me() });
  }, []);

  const unpair = useCallback(() => unpairLocally(), [unpairLocally]);

  const retry = useCallback(async () => {
    setState({ status: 'starting' });
    await resume();
  }, [resume]);

  const reload = useCallback(async () => {
    const me = await api.me();
    setState({ status: 'ready', me });
  }, []);

  const value = useMemo<SessionApi>(
    () => ({ state, prefs, setPrefs, pair, unpair, retry, reload }),
    [state, prefs, setPrefs, pair, unpair, retry, reload]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** The account info; only call from screens shown while paired. */
export function useMe(): Me {
  const { state } = useSession();
  if (state.status !== 'ready') throw new Error('useMe while not paired');
  return state.me;
}
