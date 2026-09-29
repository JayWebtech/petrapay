"use client";

import { chainMeta } from "@petrapay/shared";
import { ArrowDown, BadgeCheck, KeyRound, Lock, Wallet } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { TextScramble } from "@/components/motion/text-scramble";
import { cn } from "@/lib/utils";
import { TokenIcon } from "../token-icon";
import { Accent, Reveal, SectionHeading } from "./reveal";

export type PriceToken = { symbol: string; chain: string; priceUsd: number };

function Card({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={className}>
      <div className="group relative h-full overflow-hidden rounded-[28px] border border-border bg-white p-6 transition-shadow duration-300 hover:shadow-[0_24px_60px_-30px_rgba(59,40,204,0.45)] md:p-7">
        {children}
      </div>
    </Reveal>
  );
}

function CardTitle({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div>
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

const AMOUNTS = [50, 250, 1000, 5000];

/** Estimates what a client sends and the creator receives, from live token prices. */
function Estimator({ tokens, zecPrice }: { tokens: PriceToken[]; zecPrice: number | null }) {
  const [amount, setAmount] = useState(250);
  const [tokenKey, setTokenKey] = useState(tokens[0] ? `${tokens[0].symbol}-${tokens[0].chain}` : "");
  const token = tokens.find((t) => `${t.symbol}-${t.chain}` === tokenKey) ?? tokens[0];
  const receive = zecPrice ? amount / zecPrice : 0;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 5 : n < 100 ? 3 : 2 });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.02em]">Price it in dollars. Get paid in ZEC.</h3>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            Your client pays the invoice&apos;s value in whatever they hold. You receive ZEC worth exactly that amount when they pay.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live prices
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Invoice</span>
        {AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(a)}
            className={cn(
              "press rounded-full border px-3.5 py-1.5 text-sm font-medium tabular transition-colors",
              amount === a ? "border-primary bg-primary text-white" : "border-border bg-white hover:border-primary/40",
            )}
          >
            ${a.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="mt-6 grid flex-1 gap-3 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-border bg-muted/40 p-2">
          <p className="px-2 pt-1.5 pb-2 text-xs text-muted-foreground">Same invoice, paid any way</p>
          <div className="space-y-1">
            {tokens.map((t) => {
              const key = `${t.symbol}-${t.chain}`;
              const active = key === tokenKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTokenKey(key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    active ? "bg-white shadow-[0_4px_16px_-8px_rgba(59,40,204,0.35)] ring-1 ring-primary/25" : "hover:bg-white/70",
                  )}
                >
                  <TokenIcon symbol={t.symbol} chain={t.chain} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.symbol}</span>
                    <span className="block text-[11px] text-muted-foreground">on {chainMeta(t.chain).name}</span>
                  </span>
                  <span className={cn("text-sm tabular", active ? "font-semibold" : "text-muted-foreground")}>
                    {t.priceUsd > 0 ? fmt(amount / t.priceUsd) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-[#0b0a24] p-5 text-white">
          <div aria-hidden="true" className="absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(closest-side,rgba(245,222,176,0.25),transparent)]" />
          <p className="flex items-center gap-1.5 text-xs text-white/60">
            <Lock className="size-3 text-[#f5deb0]" /> You receive, shielded
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#f5deb0] tabular">
            <AnimatedNumber value={receive} startOnView={false} duration={0.6} format={(n) => n.toFixed(4)} />
          </p>
          <p className="text-sm text-white/60">ZEC · Orchard pool</p>
          <div className="mt-auto space-y-2 pt-6 text-xs text-white/70">
            <p className="flex justify-between gap-3">
              <span className="text-white/50">Route</span>
              <span>{token ? `${token.symbol} on ${chainMeta(token.chain).name} → ZEC` : "—"}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-white/50">Fees</span>
              <span>Shown to your client up front</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-white/50">If it fails</span>
              <span>Refunded to the payer</span>
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Estimate from live market prices. Checkout shows the exact signed quote.</p>
    </div>
  );
}

const ADDRESSES = ["u1qx7k…9fa3", "u1m4tz…c2e8", "u18dlp…47hw", "u1rf9e…m0q2", "u1c3vn…t8ya"];

function AddressRotator() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => n + 1), 1800);
    return () => window.clearInterval(id);
  }, [reduce]);
  const rows = [0, 1, 2].map((k) => ({ n: i + k, addr: ADDRESSES[(i + k) % ADDRESSES.length]! }));
  return (
    <div className="mt-6 space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((r, k) => (
          <motion.div
            key={r.n}
            layout
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: k === 0 ? 1 : 0.55 - k * 0.12, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm"
          >
            <span className="font-mono text-xs">{r.addr}</span>
            <span className="text-xs text-muted-foreground">Invoice #{String(40 + r.n).padStart(3, "0")}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const NOTE_STATES = ["Acme Inc.", "enc1:9Gs_4ZL836yZtv6rkSa0"];

function NoteScramble() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % NOTE_STATES.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);
  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{i === 0 ? "In your browser" : "What our server stores"}</span>
        <KeyRound className="size-3.5" />
      </div>
      <p className="mt-2 truncate font-mono text-sm">
        <TextScramble text={NOTE_STATES[i]!} duration={700} />
      </p>
    </div>
  );
}

const WALLETS = ["MetaMask", "Phantom", "Rabby", "Solflare", "Coinbase", "Backpack", "Zashi", "Any exchange"];

export function Bento({ tokens, zecPrice }: { tokens: PriceToken[]; zecPrice: number | null }) {
  return (
    <section id="features" className="scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              Everything a creator needs. <Accent>Nothing an explorer can read.</Accent>
            </>
          }
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 md:row-span-2">
            <Estimator tokens={tokens} zecPrice={zecPrice} />
          </Card>
          <Card delay={0.05}>
            <CardTitle icon={<Lock className="size-5" />} title="A fresh address per invoice" body="Each invoice settles to its own shielded address, so payments can't be linked." />
            <AddressRotator />
          </Card>
          <Card delay={0.1}>
            <CardTitle icon={<KeyRound className="size-5" />} title="Client names, encrypted" body="Encrypted in your browser with your account key. We only ever see ciphertext." />
            <NoteScramble />
          </Card>
          <Card delay={0.05}>
            <CardTitle icon={<Wallet className="size-5" />} title="Pay from any wallet" body="One click for EVM and Solana wallets, QR for everything else." />
            <div className="mt-5 flex flex-wrap gap-1.5">
              {WALLETS.map((w) => (
                <span key={w} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors group-hover:border-primary/20">
                  {w}
                </span>
              ))}
            </div>
          </Card>
          <Card delay={0.1}>
            <CardTitle icon={<BadgeCheck className="size-5" />} title="Signed, refundable quotes" body="Every quote is signed by the swap network and verified before you see a deposit address." />
            <div className="mt-5 rounded-xl bg-[#0b0a24] p-3 font-mono text-[11px] leading-relaxed text-white/70">
              <p>
                <span className="text-[#9bf0c3]">✓</span> signature ed25519 · verified
              </p>
              <p>
                <span className="text-[#9bf0c3]">✓</span> recipient matches invoice
              </p>
              <p>
                <span className="text-[#f5deb0]">↺</span> refundTo: your own address
              </p>
            </div>
          </Card>
          <Card delay={0.15}>
            <CardTitle icon={<ArrowDown className="size-5 -rotate-90" />} title="Cash out anywhere" body="Swap ZEC to USDC, SOL, ETH or 100+ assets on the chain you need." />
            <div className="mt-5 flex items-center gap-2">
              <TokenIcon symbol="ZEC" chain="zec" size={32} />
              <span className="h-px flex-1 bg-[linear-gradient(90deg,#d4a54a,#3b28cc)]" />
              <div className="flex -space-x-2">
                <TokenIcon symbol="USDC" chain="base" size={32} className="rounded-full ring-2 ring-white" />
                <TokenIcon symbol="SOL" chain="sol" size={32} className="rounded-full ring-2 ring-white" />
                <TokenIcon symbol="ETH" chain="eth" size={32} className="rounded-full ring-2 ring-white" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
