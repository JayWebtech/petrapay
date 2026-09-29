"use client";

import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { textareaClass } from "@/components/app/field";
import { Loader } from "@/components/motion/loader";
import { errorMessage } from "@/lib/api";
import { isValidPhrase, publicKeyFromPhrase } from "@/lib/identity";
import { cn } from "@/lib/utils";

/**
 * Devices set up before payment links only hold the signing and notes keys. Re-entering the
 * recovery phrase derives the box key too, and the auth provider publishes its public half.
 */
export function UnlockWithPhrase({ title, body, className }: { title: string; body: string; className?: string }) {
  const { me, signInWithPhrase } = useAuth();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPhrase(phrase)) return setError("That isn't a valid 12-word recovery phrase.");
    if (me && publicKeyFromPhrase(phrase) !== me.publicKey) return setError("This phrase belongs to a different account.");
    setBusy(true);
    try {
      await signInWithPhrase(phrase);
      setPhrase("");
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-primary/25 bg-[#f6f5fe] p-4 text-sm", className)}>
      <div className="flex gap-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-muted-foreground">{body}</p>
          {open ? (
            <form onSubmit={submit} className="mt-3 space-y-2">
              <textarea
                value={phrase}
                onChange={(e) => {
                  setPhrase(e.target.value);
                  setError(null);
                }}
                rows={2}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                placeholder="twelve words separated by spaces"
                aria-label="Recovery phrase"
                className={cn(textareaClass, "font-mono text-sm")}
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !phrase.trim()} className="btn-solid h-9 rounded-xl px-3.5 text-sm font-semibold">
                  {busy ? <Loader variant="spinner" size={14} /> : null} Unlock
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl px-3 text-sm text-muted-foreground hover:bg-white">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Your phrase stays on this device. Only the derived keys are stored, non-extractably.</p>
            </form>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="btn-soft mt-3 h-9 rounded-xl px-3.5 text-sm font-medium">
              Enter recovery phrase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
