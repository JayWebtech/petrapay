"use client";

import { Download, Eye, EyeOff, FileKey2, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { UnlockWithPhrase } from "@/components/app/links/unlock-box";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/motion/button";
import { forgetSavedPhrase, hasSavedPhrase, identityVersion, revealPhrase, subscribeIdentity } from "@/lib/identity";

const AUTO_HIDE_MS = 60_000;

/** Settings card: show the recovery phrase saved (encrypted) on this device. */
export function RecoveryPhraseCard() {
  const toast = useToast();
  const version = useSyncExternalStore(subscribeIdentity, identityVersion, () => 0);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let live = true;
    hasSavedPhrase().then((v) => live && setSaved(v));
    return () => {
      live = false;
    };
  }, [version]);

  // Hide the words again after a minute, or when the tab is hidden.
  useEffect(() => {
    if (!phrase) return;
    const t = window.setTimeout(() => setPhrase(null), AUTO_HIDE_MS);
    const onHide = () => document.hidden && setPhrase(null);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phrase]);

  const reveal = async () => {
    const p = await revealPhrase();
    setConfirming(false);
    if (p) setPhrase(p);
    else toast.error("Couldn't read your phrase", "The saved copy on this device couldn't be decrypted.");
  };

  const download = () => {
    if (!phrase) return;
    const blob = new Blob(
      [`PetraPay recovery phrase\n\n${phrase}\n\nAnyone with these words can sign in to your PetraPay account. Store them offline.\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petrapay-recovery-phrase.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    await forgetSavedPhrase();
    setPhrase(null);
    setRemoving(false);
    toast.success("Removed from this device", "You're still signed in. Keep your written copy safe.");
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileKey2 className="size-4 text-muted-foreground" /> Recovery phrase
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Your 12 words sign you in on any device. A copy is kept encrypted in this browser only; PetraPay&apos;s servers never see it.
      </p>

      {saved === null ? null : !saved ? (
        <UnlockWithPhrase
          className="mt-4"
          title="Not saved on this device"
          body="This browser has no copy of your phrase, and the words can't be rebuilt from your keys. If you still have them, enter them once to keep a copy here. If you've lost them, your account still works on this device: keep it signed in, and your funds are always safe in your Zcash wallet."
        />
      ) : phrase ? (
        <div className="mt-4">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {phrase.split(" ").map((w, i) => (
              <li key={`${w}-${i}`} className="flex items-baseline gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 font-mono text-sm">
                <span className="w-4 text-right text-[10px] text-muted-foreground">{i + 1}</span>
                <span>{w}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Hides automatically after a minute.</span>
            <div className="flex items-center gap-1">
              <CopyButton value={phrase} label="Copy phrase" text="Copy" showLabel />
              <button
                type="button"
                onClick={download}
                className="press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="size-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={() => setPhrase(null)}
                className="press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <EyeOff className="size-3.5" /> Hide
              </button>
            </div>
          </div>
        </div>
      ) : confirming ? (
        <div className="mt-4 rounded-2xl border border-[#9a3f00]/25 bg-[#fff7ef] p-4 text-sm">
          <p className="font-semibold text-[#9a3f00]">Make sure no one can see your screen</p>
          <p className="mt-1 text-foreground/75">Anyone with these words controls your PetraPay account. PetraPay will never ask you for them.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={reveal}>
              <Eye className="size-3.5" /> Show my phrase
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
            <Eye className="size-3.5" /> Reveal recovery phrase
          </Button>
          {removing ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Remove the copy from this browser?</span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={remove}>
                Remove
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setRemoving(true)}>
              <Trash2 className="size-3.5" /> Remove from this device
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
