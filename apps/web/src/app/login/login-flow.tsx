"use client";

import { ArrowLeft, Download, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { CopyButton } from "@/components/app/copy-button";
import { textareaClass } from "@/components/app/field";
import { Logo } from "@/components/app/logo";
import { useToast } from "@/components/app/toaster";
import { StatefulButton, type ButtonState } from "@/components/motion/button";
import { Checkbox } from "@/components/motion/checkbox";
import { errorMessage } from "@/lib/api";
import { createRecoveryPhrase, fingerprint, isValidPhrase, normalizePhrase } from "@/lib/identity";

type Mode = "choose" | "create" | "restore";

export function LoginFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useAuth();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "restore" ? "restore" : "choose");
  const next = params.get("next") ?? "/dashboard";

  useEffect(() => {
    if (status === "authed") router.replace(next);
  }, [status, next, router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="absolute top-6 left-6">
        <Logo />
      </div>
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {mode === "choose" ? <Choose onPick={setMode} /> : null}
            {mode === "create" ? <Create onBack={() => setMode("choose")} onDone={() => router.replace(next)} /> : null}
            {mode === "restore" ? <Restore onBack={() => setMode("choose")} onDone={() => router.replace(next)} /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Choose({ onPick }: { onPick: (m: Mode) => void }) {
  const { deviceKey, unlock } = useAuth();
  const toast = useToast();
  const [unlocking, setUnlocking] = useState(false);
  const continueOnDevice = async () => {
    setUnlocking(true);
    try {
      await unlock();
    } catch (err) {
      toast.error("Couldn't sign in", errorMessage(err));
      setUnlocking(false);
    }
  };
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{deviceKey ? "Welcome back" : "Welcome to PetraPay"}</h1>
      <p className="mt-2 text-muted-foreground">No email, no password. Your account is a private key that stays on this device.</p>
      <div className="mt-8 space-y-3">
        {deviceKey ? (
          <button
            type="button"
            disabled={unlocking}
            onClick={continueOnDevice}
            className="card press flex w-full items-center gap-4 border-primary/50 p-5 text-left transition-colors hover:border-primary disabled:opacity-60"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <span>
              <span className="block font-medium">Continue on this device</span>
              <span className="block font-mono text-sm text-muted-foreground">Account {fingerprint(deviceKey)}</span>
            </span>
          </button>
        ) : null}
        <button type="button" onClick={() => onPick("create")} className="card press flex w-full items-center gap-4 p-5 text-left transition-colors hover:border-primary/50">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span>
            <span className="block font-medium">Create a new account</span>
            <span className="block text-sm text-muted-foreground">Takes 20 seconds. You&apos;ll get a recovery phrase.</span>
          </span>
        </button>
        <button type="button" onClick={() => onPick("restore")} className="card press flex w-full items-center gap-4 p-5 text-left transition-colors hover:border-primary/50">
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-foreground">
            <KeyRound className="size-5" />
          </span>
          <span>
            <span className="block font-medium">I have a recovery phrase</span>
            <span className="block text-sm text-muted-foreground">Sign in on this device with your 12 words.</span>
          </span>
        </button>
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}

function Create({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { signInWithPhrase } = useAuth();
  const toast = useToast();
  const phrase = useMemo(() => createRecoveryPhrase(), []);
  const words = phrase.split(" ");
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<ButtonState>("idle");

  const download = () => {
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

  const submit = async () => {
    setState("loading");
    try {
      await signInWithPhrase(phrase);
      setState("success");
      window.setTimeout(onDone, 500);
    } catch (err) {
      setState("error");
      toast.error("Couldn't create your account", errorMessage(err));
      window.setTimeout(() => setState("idle"), 1600);
    }
  };

  return (
    <div>
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-semibold tracking-tight">Save your recovery phrase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        These 12 words are your account. PetraPay can&apos;t recover them for you. Write them down or store them in a password manager.
      </p>
      <div className="card mt-6 p-4">
        <ol className="grid grid-cols-3 gap-2">
          {words.map((w, i) => (
            <li key={`${w}-${i}`} className="flex items-baseline gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 font-mono text-sm">
              <span className="w-4 text-right text-[10px] text-muted-foreground">{i + 1}</span>
              <span>{w}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
          <CopyButton value={phrase} label="Copy phrase" text="Copy phrase" showLabel />
          <button
            type="button"
            onClick={download}
            className="press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="size-3.5" /> Download
          </button>
        </div>
      </div>
      <div className="mt-5">
        <Checkbox checked={saved} onCheckedChange={setSaved} label="I've saved my recovery phrase somewhere safe" />
      </div>
      <StatefulButton
        className="mt-6 w-full"
        size="lg"
        disabled={!saved}
        state={state}
        onClick={submit}
        loadingText="Creating account"
        successText="Welcome aboard"
        icon={<ShieldCheck className="size-4" />}
      >
        Create account
      </StatefulButton>
    </div>
  );
}

function Restore({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { signInWithPhrase } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ButtonState>("idle");
  const wordCount = normalizePhrase(phrase) ? normalizePhrase(phrase).split(" ").length : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhrase(phrase)) {
      setError("That doesn't look like a valid 12-word phrase. Check spelling and word order.");
      return;
    }
    setError(null);
    setState("loading");
    try {
      await signInWithPhrase(phrase);
      setState("success");
      window.setTimeout(onDone, 400);
    } catch (err) {
      setState("error");
      setError(errorMessage(err));
      window.setTimeout(() => setState("idle"), 1600);
    }
  };

  return (
    <form onSubmit={submit}>
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-semibold tracking-tight">Sign in with your phrase</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter your 12 words separated by spaces. They&apos;re only used in this browser to derive your key.</p>
      <label className="mt-6 block">
        <span className="sr-only">Recovery phrase</span>
        <textarea
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          rows={4}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="word1 word2 word3 …"
          className={`${textareaClass} font-mono text-sm`}
        />
      </label>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className="text-destructive">{error}</span>
        <span className="text-muted-foreground tabular">{wordCount}/12</span>
      </div>
      <StatefulButton type="submit" className="mt-5 w-full" size="lg" state={state} disabled={wordCount < 12} loadingText="Signing in" successText="Signed in">
        Sign in
      </StatefulButton>
    </form>
  );
}
