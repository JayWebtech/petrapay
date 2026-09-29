"use client";

import type { MeDTO } from "@petrapay/shared";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader } from "@/components/app/dash/ui";
import { TextField } from "@/components/app/field";
import { useToast } from "@/components/app/toaster";
import { Button, StatefulButton, type ButtonState } from "@/components/motion/button";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { fingerprint } from "@/lib/identity";

export default function SettingsPage() {
  const { me, refresh, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const config = useApi<{ confidentiality: string }>("/config");
  // null = untouched, so the field shows the saved name until the user edits it.
  const [draft, setDraft] = useState<string | null>(null);
  const [state, setState] = useState<ButtonState>("idle");
  const name = draft ?? me?.displayName ?? "";

  if (!me) return null;

  const save = async () => {
    setState("loading");
    try {
      await api<MeDTO>("/me", { method: "PATCH", body: { displayName: name } });
      await refresh();
      setDraft(null);
      setState("success");
      window.setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("error");
      toast.error("Couldn't save", errorMessage(err));
      window.setTimeout(() => setState("idle"), 1500);
    }
  };

  const confidential = config.data && config.data.confidentiality !== "public";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Your studio profile, account key and privacy options." />

      <section className="card p-5">
        <p className="text-sm font-medium">Studio name</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Shown to clients at the top of every invoice. Use a brand name if you&apos;d rather not use your own.</p>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex-1">
            <TextField value={name} onChange={setDraft} placeholder="Ada Studio" aria-label="Studio name" />
          </div>
          <StatefulButton className="h-12 rounded-2xl px-6" state={state} onClick={save} disabled={!name.trim() || name === me.displayName} successText="Saved">
            Save
          </StatefulButton>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-muted-foreground" /> Account key
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your account is this ed25519 public key. The private key is stored non-extractably in this browser and derives from your recovery phrase.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <span className="font-mono text-sm font-medium">{fingerprint(me.publicKey)}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{me.publicKey}</span>
          <CopyButton value={me.publicKey} label="Copy public key" />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-muted-foreground" /> Swap privacy
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {confidential
            ? `Confidential routing is on (${config.data?.confidentiality}). Payer deposits and your ZEC deliveries route through our confidential layer, so they can't be matched to each other.`
            : "Swaps use our public routing layer. Each invoice still settles to its own shielded address. The operator can enable confidential routing with a partner key."}
        </p>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium">Sign out</p>
          <p className="text-xs text-muted-foreground">&ldquo;Forget this device&rdquo; removes the key from this browser. You&apos;ll need your phrase to sign back in.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => signOut().then(() => router.replace("/"))}>
            <LogOut className="size-3.5" /> Sign out
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => signOut({ forgetDevice: true }).then(() => router.replace("/"))}>
            Forget this device
          </Button>
        </div>
      </section>
    </div>
  );
}
