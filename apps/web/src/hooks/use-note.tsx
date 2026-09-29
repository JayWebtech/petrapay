"use client";

import { useEffect, useState } from "react";
import { isSealed, openNote } from "@/lib/identity";

/** Decrypts an end-to-end encrypted note for display. `undefined` while decrypting, `null` if locked. */
export function useNote(value: string | null | undefined): string | null | undefined {
  const [opened, setOpened] = useState<{ value: string; plain: string | null } | null>(null);

  useEffect(() => {
    if (!value || !isSealed(value)) return;
    let alive = true;
    openNote(value).then((plain) => {
      if (alive) setOpened({ value, plain });
    });
    return () => {
      alive = false;
    };
  }, [value]);

  if (!value) return null;
  if (!isSealed(value)) return value;
  return opened?.value === value ? opened.plain : undefined;
}

export function NoteText({ value, fallback = "" }: { value: string | null | undefined; fallback?: string }) {
  const plain = useNote(value);
  if (!value) return fallback;
  if (plain === undefined) return "…";
  if (plain === null) return "🔒 Encrypted";
  return plain;
}
