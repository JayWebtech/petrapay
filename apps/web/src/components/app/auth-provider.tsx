"use client";

import type { MeDTO } from "@petrapay/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { deviceBoxKey, forgetIdentity, loadIdentity, saveIdentity, signMessage } from "@/lib/identity";

type AuthStatus = "loading" | "authed" | "anon";

type AuthContextValue = {
  status: AuthStatus;
  me: MeDTO | null;
  /** Public key of the account key remembered on this device, if any. */
  deviceKey: string | null;
  /** Signs in with the key already stored on this device. */
  unlock: () => Promise<MeDTO>;
  refresh: () => Promise<void>;
  /** Stores the key derived from `phrase` on this device and signs in with it. */
  signInWithPhrase: (phrase: string) => Promise<MeDTO>;
  signOut: (opts?: { forgetDevice?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// After an explicit sign-out we don't silently sign back in with the device key.
const LOCK_FLAG = "pp_signed_out";
const isLocked = () => {
  try {
    return localStorage.getItem(LOCK_FLAG) === "1";
  } catch {
    return false;
  }
};
const setLocked = (locked: boolean) => {
  try {
    if (locked) localStorage.setItem(LOCK_FLAG, "1");
    else localStorage.removeItem(LOCK_FLAG);
  } catch {
    // Storage unavailable; worst case we sign in silently.
  }
};

async function signInWithDeviceKey(): Promise<MeDTO | null> {
  const identity = await loadIdentity();
  if (!identity) return null;
  const { nonce, message } = await api<{ nonce: string; message: string }>("/auth/challenge", { method: "POST" });
  const signature = await signMessage(identity, message);
  return api<MeDTO>("/auth/verify", { body: { publicKey: identity.publicKey, signature, nonce } });
}

/** Publishes this device's box key the first time, so payers can seal link form answers to it. */
async function withBoxKey(me: MeDTO): Promise<MeDTO> {
  if (me.boxPublicKey) return me;
  const boxPublicKey = await deviceBoxKey();
  if (!boxPublicKey) return me;
  return api<MeDTO>("/me/box", { method: "PUT", body: { boxPublicKey } }).catch(() => me);
}

/** Current session, or a silent sign-in with this device's key unless the user signed out. */
async function loadSession(): Promise<MeDTO | null> {
  const { me } = await api<{ me: MeDTO | null }>("/session");
  if (me) return withBoxKey(me);
  if (isLocked()) return null;
  const next = await signInWithDeviceKey().catch(() => null);
  return next ? withBoxKey(next) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<MeDTO | null>(null);
  const [deviceKey, setDeviceKey] = useState<string | null>(null);

  useEffect(() => {
    loadIdentity().then((id) => setDeviceKey(id?.publicKey ?? null));
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadSession();
    setMe(next);
    setStatus(next ? "authed" : "anon");
  }, []);

  useEffect(() => {
    let alive = true;
    loadSession()
      .then((next) => {
        if (!alive) return;
        setMe(next);
        setStatus(next ? "authed" : "anon");
      })
      .catch(() => alive && setStatus("anon"));
    return () => {
      alive = false;
    };
  }, []);

  const unlock = useCallback(async () => {
    const signedIn = await signInWithDeviceKey();
    if (!signedIn) throw new Error("No account key on this device");
    const next = await withBoxKey(signedIn);
    setLocked(false);
    setMe(next);
    setStatus("authed");
    return next;
  }, []);

  const signInWithPhrase = useCallback(
    async (phrase: string) => {
      setDeviceKey(await saveIdentity(phrase));
      return unlock();
    },
    [unlock],
  );

  const signOut = useCallback(async (opts?: { forgetDevice?: boolean }) => {
    if (opts?.forgetDevice) {
      await forgetIdentity();
      setDeviceKey(null);
    }
    setLocked(true);
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setMe(null);
    setStatus("anon");
  }, []);

  const value = useMemo(
    () => ({ status, me, deviceKey, unlock, refresh, signInWithPhrase, signOut }),
    [status, me, deviceKey, unlock, refresh, signInWithPhrase, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
