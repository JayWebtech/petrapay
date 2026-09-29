"use client";

import { checkSettlementAddress, shortAddress, type AddressDTO } from "@petrapay/shared";
import { Info, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader } from "@/components/app/dash/ui";
import { textareaClass } from "@/components/app/field";
import { useToast } from "@/components/app/toaster";
import { StatefulButton, type ButtonState } from "@/components/motion/button";
import { Loader } from "@/components/motion/loader";
import { Tooltip } from "@/components/motion/tooltip";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function AddressesPage() {
  const { refresh } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi<AddressDTO[]>("/addresses");
  const [text, setText] = useState("");
  const [state, setState] = useState<ButtonState>("idle");

  const lines = useMemo(
    () =>
      text
        .split(/[\s,]+/)
        .map((l) => l.trim())
        .filter(Boolean),
    [text],
  );
  const checks = useMemo(() => lines.map((address) => ({ address, check: checkSettlementAddress(address) })), [lines]);
  const invalid = checks.filter((c) => !c.check.ok);

  const add = async () => {
    if (lines.length === 0 || invalid.length > 0) return;
    setState("loading");
    try {
      const res = await api<{ added: number; skipped: number }>("/addresses", { body: { addresses: lines } });
      setState("success");
      setText("");
      toast.success(`Added ${res.added} address${res.added === 1 ? "" : "es"}`, res.skipped ? `${res.skipped} already in your pool` : undefined);
      await Promise.all([reload(), refresh()]);
      window.setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("error");
      toast.error("Couldn't add addresses", errorMessage(err));
      window.setTimeout(() => setState("idle"), 1500);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api(`/addresses/${id}/default`, { method: "POST" });
      await reload();
    } catch (err) {
      toast.error("Couldn't update", errorMessage(err));
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/addresses/${id}`, { method: "DELETE" });
      await Promise.all([reload(), refresh()]);
    } catch (err) {
      toast.error("Couldn't remove", errorMessage(err));
    }
  };

  const fresh = data?.filter((a) => !a.usedByInvoice).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shielded addresses"
        description="Every invoice takes a fresh address from this pool, so payments can't be linked on the public swap explorer. Zashi shows a new unified address each time you open Receive."
      />

      <div className="card p-5">
        <label htmlFor="addresses" className="text-sm font-medium">
          Add unified addresses
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">Paste one or more u1… addresses with an Orchard receiver, one per line.</p>
        <textarea
          id="addresses"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="u1…"
          className={cn(textareaClass, "mt-3 resize-y font-mono text-xs")}
        />
        {checks.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs">
            {checks.map(({ address, check }) => (
              <li key={address} className={cn("flex items-start gap-2", check.ok ? "text-muted-foreground" : "text-destructive")}>
                <span className="font-mono">{shortAddress(address, 10, 6)}</span>
                <span>
                  {check.ok
                    ? `Orchard ✓${check.receivers.sapling ? " · Sapling" : ""}${check.receivers.transparent ? " · has transparent receiver" : ""}`
                    : check.error}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {lines.length > 0 ? `${lines.length - invalid.length} valid of ${lines.length}` : "Addresses are checked in your browser before upload."}
          </p>
          <StatefulButton size="sm" state={state} disabled={lines.length === 0 || invalid.length > 0} onClick={add} loadingText="Adding" successText="Added">
            Add to pool
          </StatefulButton>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-medium">Your pool</p>
          <p className="text-xs text-muted-foreground">
            {fresh} fresh · {(data?.length ?? 0) - fresh} used
          </p>
        </div>
        {loading && !data ? (
          <div className="grid h-32 place-items-center text-muted-foreground">
            <Loader variant="dots" size={22} />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No addresses yet. Add at least one to start invoicing.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{shortAddress(a.address, 14, 8)}</span>
                    <CopyButton value={a.address} label="Copy address" />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Receiver on={a.orchard} label="Orchard" />
                    {a.sapling ? <Receiver on label="Sapling" /> : null}
                    {a.transparent ? (
                      <Tooltip content="Senders should use Orchard, but a shielded-only address rules out a public payment.">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">
                          Transparent <Info className="size-3" />
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
                <span className={cn("text-xs", a.usedByInvoice ? "text-muted-foreground" : "text-success")}>
                  {a.usedByInvoice ? "Used" : "Fresh"}
                </span>
                <Tooltip content={a.isDefault ? "Fallback when the pool runs dry" : "Make this the fallback address"}>
                  <button
                    type="button"
                    aria-label="Make default"
                    onClick={() => setDefault(a.id)}
                    className={cn("grid size-8 place-items-center rounded-lg transition-colors hover:bg-muted", a.isDefault ? "text-primary" : "text-muted-foreground")}
                  >
                    <Star className={cn("size-4", a.isDefault && "fill-current")} />
                  </button>
                </Tooltip>
                <button
                  type="button"
                  aria-label="Remove address"
                  disabled={!!a.usedByInvoice}
                  onClick={() => remove(a.id)}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Receiver({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px]",
        on ? "border-primary/30 bg-accent/60 text-accent-foreground" : "border-border text-muted-foreground line-through",
      )}
    >
      {label}
    </span>
  );
}
