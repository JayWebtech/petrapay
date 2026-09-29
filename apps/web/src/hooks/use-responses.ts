"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { SealedResponses } from "@/lib/box";
import { deviceBoxKey, identityVersion, openBox, subscribeIdentity } from "@/lib/identity";

export type ResponseField = SealedResponses["fields"][number];

export type OpenedResponses =
  | { status: "none" }
  | { status: "opening" }
  /** This device has no key that opens it (set up before payment links, or a different device). */
  | { status: "locked" }
  | { status: "open"; fields: ResponseField[] };

function parse(plain: string): ResponseField[] | null {
  try {
    const data = JSON.parse(plain) as SealedResponses;
    if (data.v !== 1 || !Array.isArray(data.fields)) return null;
    return data.fields.filter((f) => typeof f.label === "string" && typeof f.value === "string");
  } catch {
    return null;
  }
}

/** Decrypts a payer's sealed form answers on this device. */
export function useResponses(sealed: string | null | undefined): OpenedResponses {
  const version = useSyncExternalStore(subscribeIdentity, identityVersion, () => 0);
  const [opened, setOpened] = useState<{ key: string; fields: ResponseField[] | null } | null>(null);
  const key = sealed ? `${version}:${sealed}` : null;

  useEffect(() => {
    if (!sealed || !key) return;
    let alive = true;
    openBox(sealed).then((plain) => {
      if (alive) setOpened({ key, fields: plain === null ? null : parse(plain) });
    });
    return () => {
      alive = false;
    };
  }, [sealed, key]);

  if (!sealed) return { status: "none" };
  if (opened?.key !== key) return { status: "opening" };
  return opened.fields ? { status: "open", fields: opened.fields } : { status: "locked" };
}

/** The box public key stored on this device: undefined while loading, null if this device has none. */
export function useDeviceBoxKey(): string | null | undefined {
  const version = useSyncExternalStore(subscribeIdentity, identityVersion, () => 0);
  const [state, setState] = useState<{ version: number; key: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    deviceBoxKey().then((key) => {
      if (alive) setState({ version, key });
    });
    return () => {
      alive = false;
    };
  }, [version]);

  return state?.version === version ? state.key : undefined;
}
