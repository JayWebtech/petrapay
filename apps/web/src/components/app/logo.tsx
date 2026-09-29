import Link from "next/link";
import { cn } from "@/lib/utils";

/** Faceted stone mark: "petra" is Greek for rock. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <path d="M16 2 28 9v14l-12 7-12-7V9z" fill="var(--primary)" />
      <path d="M16 2v28l12-7V9z" fill="#000" fillOpacity=".18" />
      <path d="M4 9l12 7 12-7" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" />
      <path d="M16 16v14" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      <span className="text-[17px]">PetraPay</span>
    </Link>
  );
}
