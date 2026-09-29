"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";

type Entry<T> = { path: string | null; data: T | null; error: string | null };

/**
 * Minimal data hook: fetch on mount and when `path` changes, optional polling, manual reload.
 * `pollWhile` stops polling once the data reaches a settled state.
 */
export function useApi<T>(
  path: string | null,
  opts: { pollMs?: number; pollWhile?: (data: T | null) => boolean; keepPrevious?: boolean } = {},
) {
  const [entry, setEntry] = useState<Entry<T>>({ path: null, data: null, error: null });
  // Ignore state that belongs to a previous path, unless the caller wants to keep showing it while refetching.
  const stale = entry.path !== path;
  const current: Entry<T> = !stale ? entry : opts.keepPrevious ? { path, data: entry.data, error: null } : { path, data: null, error: null };

  const load = useCallback(async (target: string) => {
    try {
      const data = await api<T>(target);
      setEntry({ path: target, data, error: null });
    } catch (err) {
      setEntry((prev) => ({ path: target, data: prev.path === target ? prev.data : null, error: errorMessage(err) }));
    }
  }, []);

  const tick = useEffectEvent(() => {
    if (!path || document.visibilityState !== "visible") return;
    if (opts.pollWhile && !opts.pollWhile(current.data)) return;
    void load(path);
  });

  useEffect(() => {
    if (!path) return;
    void load(path);
    if (!opts.pollMs) return;
    const id = window.setInterval(tick, opts.pollMs);
    return () => window.clearInterval(id);
  }, [path, opts.pollMs, load]);

  const reload = useCallback(() => (path ? load(path) : Promise.resolve()), [path, load]);
  const setData = useCallback((data: T) => setEntry({ path, data, error: null }), [path]);

  return {
    data: current.data,
    error: current.error,
    loading: !!path && current.data === null && current.error === null,
    /** True while showing data from a previous path (only with keepPrevious). */
    stale: stale && !!opts.keepPrevious && current.data !== null,
    reload,
    setData,
  };
}
