"use client";

import type { TokenDTO } from "@petrapay/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cache: { at: number; tokens: TokenDTO[] } | null = null;
let inflight: Promise<TokenDTO[]> | null = null;

function loadTokens(): Promise<TokenDTO[]> {
  if (cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.tokens);
  inflight ??= api<TokenDTO[]>("/tokens")
    .then((tokens) => {
      cache = { at: Date.now(), tokens };
      return tokens;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useTokens() {
  const [tokens, setTokens] = useState<TokenDTO[] | null>(cache?.tokens ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadTokens()
      .then((t) => alive && setTokens(t))
      .catch(() => alive && setError("Couldn't load supported tokens"));
    return () => {
      alive = false;
    };
  }, []);
  return { tokens, error };
}
