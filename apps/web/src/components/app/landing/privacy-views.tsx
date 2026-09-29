"use client";

import { Eye, EyeOff, Globe2, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Accent, Reveal, SectionHeading } from "./reveal";

// Illustrative sample data for the comparison, not real transactions.
const EXPLORER_ROWS = [
  { hash: "0x93af…0fd5", what: "Deposit · 1,262.41 USDC", where: "Base", to: "one-time address" },
  { hash: "7Hq2…cPx1", what: "Swap USDC → ZEC", where: "Swap network", to: "u1qx7k…9fa3 (single use)" },
  { hash: "c41e…9b07", what: "Orchard note", where: "Zcash", to: "████████" },
];

const YOUR_ROWS = [
  { client: "Acme Inc.", title: "Brand identity", zec: "+0.8474" },
  { client: "Globex", title: "Podcast intro", zec: "+0.1200" },
  { client: "Initech", title: "Site redesign", zec: "+2.3100" },
];

const redacted = "select-none rounded bg-foreground/80 text-transparent";

export function PrivacyViews() {
  const [view, setView] = useState<"explorer" | "you">("explorer");
  return (
    <section id="privacy" className="scroll-mt-28 bg-[#f7f6fd] py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <SectionHeading
            eyebrow="Privacy model"
            title={
              <>
                Public business. <Accent>Private balance sheet.</Accent>
              </>
            }
            body="Your clients see a normal checkout. Block explorers see one-time addresses that lead nowhere. Only you see the full picture."
          />
          <Reveal delay={0.1} className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Globe2, t: "Public", d: "A deposit on the payer's chain and a swap to a single-use recipient." },
              { icon: Lock, t: "Shielded", d: "Your balance, total earnings, client list and where ZEC goes next." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-border bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <x.icon className="size-4 text-primary" /> {x.t}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="rounded-[28px] border border-border bg-white p-2 shadow-[0_30px_80px_-40px_rgba(59,40,204,0.45)]">
            <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-3">
              <Tabs value={view} onValueChange={(v) => setView(v as "explorer" | "you")} variant="segment">
                <TabsList>
                  <TabsTrigger value="explorer">Block explorer</TabsTrigger>
                  <TabsTrigger value="you">Your dashboard</TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                {view === "explorer" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {view === "explorer" ? "Anyone" : "Only you"}
              </span>
            </div>
            <div className="relative min-h-[300px] overflow-hidden rounded-[22px] bg-muted/60">
              <AnimatePresence mode="wait" initial={false}>
                {view === "explorer" ? (
                  <motion.div
                    key="explorer"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4"
                  >
                    <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-3 px-2 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <span>Tx</span>
                      <span>Activity</span>
                      <span>Recipient</span>
                    </div>
                    <div className="space-y-2">
                      {EXPLORER_ROWS.map((r) => (
                        <div key={r.hash} className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-3 rounded-xl bg-white px-3 py-3 text-xs">
                          <span className="font-mono text-muted-foreground">{r.hash}</span>
                          <span>
                            {r.what}
                            <span className="block text-[11px] text-muted-foreground">{r.where}</span>
                          </span>
                          <span className={r.to.startsWith("█") ? `${redacted} w-fit font-mono` : "font-mono text-muted-foreground"}>{r.to}</span>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="rounded-xl bg-white px-3 py-3 text-xs">
                          <p className="text-muted-foreground">Creator balance</p>
                          <p className={`${redacted} mt-1 w-24 font-mono`}>hidden</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3 text-xs">
                          <p className="text-muted-foreground">Other invoices</p>
                          <p className={`${redacted} mt-1 w-20 font-mono`}>unlinked</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="you"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4"
                  >
                    <div className="rounded-2xl bg-[#0b0a24] p-4 text-white">
                      <p className="flex items-center gap-1.5 text-xs text-white/60">
                        <Lock className="size-3 text-[#f5deb0]" /> Received, shielded
                      </p>
                      <p className="mt-1 text-3xl font-semibold tracking-tight text-[#f5deb0] tabular">
                        3.2774 <span className="text-base text-white/60">ZEC</span>
                      </p>
                    </div>
                    <div className="mt-2 space-y-2">
                      {YOUR_ROWS.map((r) => (
                        <div key={r.client} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm">
                          <span>
                            <span className="font-medium">{r.client}</span>
                            <span className="text-muted-foreground"> · {r.title}</span>
                          </span>
                          <span className="font-medium text-success tabular">{r.zec} ZEC</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
