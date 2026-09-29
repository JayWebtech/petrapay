"use client";

import { chainMeta, type TokenDTO } from "@petrapay/shared";
import { Check, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { TokenIcon } from "./token-icon";

/** Tokens most payers hold, shown first and as quick picks. */
export const POPULAR_PAIRS: [symbol: string, chain: string][] = [
  ["USDC", "base"],
  ["USDC", "sol"],
  ["SOL", "sol"],
  ["ETH", "base"],
  ["USDT", "tron"],
  ["ETH", "eth"],
  ["BTC", "btc"],
  ["USDC", "eth"],
  ["USDT", "eth"],
  ["USDC", "arb"],
];

export function popularTokens(tokens: TokenDTO[], exclude: string[] = [], limit = POPULAR_PAIRS.length): TokenDTO[] {
  return POPULAR_PAIRS.map(([s, c]) => tokens.find((t) => t.symbol === s && t.blockchain === c))
    .filter((t): t is TokenDTO => !!t && !exclude.includes(t.assetId))
    .slice(0, limit);
}

const popularRank = (t: TokenDTO) => {
  const i = POPULAR_PAIRS.findIndex(([s, c]) => s === t.symbol && c === t.blockchain);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

/** Lower is better: exact symbol, then symbol prefix, then symbol contains, then chain/contract matches. */
function relevance(t: TokenDTO, words: string[]): number {
  if (words.length === 0) return 0;
  const sym = t.symbol.toLowerCase();
  const first = words[0]!;
  if (sym === first) return 0;
  if (sym.startsWith(first)) return 1;
  if (sym.includes(first)) return 2;
  return 3;
}

const DESKTOP = "(min-width: 640px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

export function TokenSelector({
  open,
  onClose,
  tokens,
  onSelect,
  exclude = [],
  selectedId,
  estimate,
  title = "Select a token",
}: {
  open: boolean;
  onClose: () => void;
  tokens: TokenDTO[];
  onSelect: (token: TokenDTO) => void;
  exclude?: string[];
  selectedId?: string;
  /** Optional right-hand label per token, e.g. the amount this invoice would cost in it. */
  estimate?: (token: TokenDTO) => string | null;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [chain, setChain] = useState("all");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const available = useMemo(() => tokens.filter((t) => !exclude.includes(t.assetId)), [tokens, exclude]);

  const chains = useMemo(() => {
    const ids = [...new Set(available.map((t) => t.blockchain))];
    return ids.sort((a, b) => chainMeta(a).rank - chainMeta(b).rank || a.localeCompare(b));
  }, [available]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return available
      .filter((t) => chain === "all" || t.blockchain === chain)
      .filter((t) => {
        if (words.length === 0) return true;
        const hay = [t.symbol, chainMeta(t.blockchain).name, t.blockchain, t.contractAddress ?? ""].join(" ").toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort(
        (a, b) =>
          relevance(a, words) - relevance(b, words) ||
          popularRank(a) - popularRank(b) ||
          chainMeta(a.blockchain).rank - chainMeta(b.blockchain).rank ||
          a.symbol.localeCompare(b.symbol),
      );
  }, [available, chain, query]);

  const quickPicks = useMemo(() => popularTokens(available, [], 6), [available]);
  const showQuickPicks = query.trim() === "" && chain === "all";

  // Start fresh each time the selector closes (state adjusted during render, per React docs).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setChain("all");
      setActive(0);
    }
  }
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (t: TokenDTO) => {
    onSelect(t);
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = results[active];
      if (t) choose(t);
    }
  };

  if (!isClient) return null;

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : desktop
      ? {
          initial: { opacity: 0, scale: 0.96, y: 12, filter: "blur(4px)" },
          animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
          exit: { opacity: 0, scale: 0.97, y: 8, filter: "blur(4px)" },
        }
      : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKeyDown}>
          <motion.button
            type="button"
            aria-label="Close token selector"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[#110f24]/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            {...panelMotion}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.7 }}
            className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-white shadow-[0_30px_80px_-20px_rgba(17,15,36,0.35)] sm:max-h-[640px] sm:max-w-[440px] sm:rounded-[28px]"
          >
            <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 pt-3 sm:pt-5">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="shrink-0 px-5 pt-3">
              <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-border bg-muted/50 px-3.5 transition-colors focus-within:border-primary/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Search token, chain or contract"
                  aria-label="Search tokens"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">esc</kbd>
                )}
              </label>
            </div>

            <div className="mt-3 flex shrink-0 gap-1.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {["all", ...chains].map((id) => {
                const meta = id === "all" ? null : chainMeta(id);
                const on = chain === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setChain(id);
                      setActive(0);
                    }}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      on ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {meta ? <span className="size-2 rounded-full" style={{ background: meta.color }} /> : null}
                    {meta ? meta.name : "All chains"}
                  </button>
                );
              })}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto border-t border-border px-3 pt-3 pb-4">
              {showQuickPicks && quickPicks.length ? (
                <div className="px-2 pb-3">
                  <p className="pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Popular</p>
                  <div className="grid grid-cols-3 gap-2">
                    {quickPicks.map((t) => (
                      <button
                        key={t.assetId}
                        type="button"
                        onClick={() => choose(t)}
                        className={cn(
                          "btn-soft h-auto flex-col gap-1 rounded-2xl px-2 py-2.5",
                          selectedId === t.assetId && "border-primary/60",
                        )}
                      >
                        <TokenIcon symbol={t.symbol} chain={t.blockchain} size={28} />
                        <span className="text-xs font-semibold">{t.symbol}</span>
                        <span className="-mt-1 text-[10px] text-muted-foreground">{chainMeta(t.blockchain).name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="px-2 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {showQuickPicks ? "All tokens" : `${results.length} result${results.length === 1 ? "" : "s"}`}
              </p>
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium">No tokens match &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a symbol like USDC, or a chain like Base.</p>
                </div>
              ) : (
                <div role="listbox" aria-label="Tokens">
                  {results.map((t, i) => {
                    const meta = chainMeta(t.blockchain);
                    const label = estimate?.(t);
                    const selected = selectedId === t.assetId;
                    return (
                      <button
                        key={t.assetId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => choose(t)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors",
                          i === active ? "bg-accent/70" : "hover:bg-muted/60",
                        )}
                      >
                        <TokenIcon symbol={t.symbol} chain={t.blockchain} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {t.symbol}
                            {selected ? <Check className="size-3.5 text-primary" /> : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">on {meta.name}</span>
                        </span>
                        {label ? <span className="shrink-0 text-right text-xs text-muted-foreground tabular">{label}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
