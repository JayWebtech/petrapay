"use client";

import { Printer, QrCode, Smartphone, Store } from "lucide-react";
import { useState } from "react";
import { Countdown } from "@/components/app/countdown";
import { PageHeader, Panel } from "@/components/app/dash/ui";
import { formatDate } from "@/components/app/invoice-row";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";

type Terminal = { id: string; name: string; createdAt: string; lastSeenAt: string | null; sales: number };

const when = (iso: string | null) => (iso ? formatDate(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not yet");

const STEPS = [
  { icon: Smartphone, title: "Install PetraPay POS", body: "On your Android payment terminal (e.g. Senraise H10)." },
  { icon: Store, title: "Pair it with a code", body: "Enter the code from this page. Each terminal gets its own access." },
  { icon: QrCode, title: "Charge customers", body: "Type the amount; the customer scans and pays with any token or shielded ZEC." },
  { icon: Printer, title: "Print the receipt", body: "The terminal prints as soon as the payment lands." },
];

export default function PointOfSalePage() {
  const toast = useToast();
  const { data: terminals, error, reload } = useApi<Terminal[]>("/pos-devices", { pollMs: 10_000 });
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const newCode = async () => {
    setBusy(true);
    try {
      setPairing(await api<{ code: string; expiresAt: string }>("/pos-devices/pairing-code", { method: "POST" }));
    } catch (err) {
      toast.error("Couldn't create a code", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Terminal) => {
    try {
      await api(`/pos-devices/${t.id}`, { method: "DELETE" });
      toast.success("Terminal removed", `${t.name} can no longer take payments.`);
      void reload();
    } catch (err) {
      toast.error("Couldn't remove terminal", errorMessage(err));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Point of sale" description="Take in-person payments on an Android terminal and print receipts. Every sale settles to a fresh shielded address." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title="How it works">
            <ol className="grid gap-4 p-5 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="icon-tile size-10 shrink-0">
                    <s.icon className="size-4.5 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {i + 1}. {s.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Paired terminals">
            {error && !terminals ? (
              <p className="px-5 py-8 text-center text-sm text-destructive">{error}</p>
            ) : !terminals ? (
              <div className="grid h-24 place-items-center text-muted-foreground">
                <Loader variant="dots" size={20} />
              </div>
            ) : terminals.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No terminals yet. Pair one with a code.</p>
            ) : (
              <ul className="divide-y divide-border">
                {terminals.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                    <span className="icon-tile size-10 shrink-0">
                      <Store className="size-4.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.sales} sale{t.sales === 1 ? "" : "s"} · last active {when(t.lastSeenAt)} · paired {formatDate(t.createdAt, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    {confirming === t.id ? (
                      <span className="flex gap-1">
                        <button type="button" onClick={() => remove(t)} className="h-8 rounded-lg bg-[#fdecec] px-2.5 text-xs font-semibold text-destructive">
                          Remove now
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(t.id)}
                        className="h-8 rounded-lg px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-[#fdecec]"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside>
          <Panel title="Pair a terminal">
            <div className="p-5">
              {pairing ? (
                <>
                  <p className="text-sm text-muted-foreground">On the terminal, open PetraPay POS and enter:</p>
                  <p className="mt-4 rounded-2xl bg-[#f6f5fe] py-5 text-center font-mono text-[32px] font-semibold tracking-[0.12em] text-primary">{pairing.code}</p>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Expires in <Countdown to={pairing.expiresAt} className="font-medium text-foreground tabular" /> · works once
                  </p>
                  <button type="button" onClick={newCode} disabled={busy} className="btn-soft mt-5 h-10 w-full rounded-xl text-sm font-medium">
                    {busy ? <Loader variant="spinner" size={14} /> : null} New code
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Get a one-time code to connect a terminal to your account. Terminals can only take payments: they can&apos;t withdraw or change settings.</p>
                  <button type="button" onClick={newCode} disabled={busy} className="btn-solid mt-5 h-12 w-full rounded-2xl text-sm font-semibold">
                    {busy ? <Loader variant="spinner" size={14} /> : <Store className="size-4" />} Get pairing code
                  </button>
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
