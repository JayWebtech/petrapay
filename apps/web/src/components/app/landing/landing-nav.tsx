"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth-provider";
import { LogoMark } from "../logo";

const LINKS = [
  { href: "#flow", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

/** Floating glass pill. Light glass over the hero's night sky, solid white once the page scrolls. */
export function LandingNav() {
  const { status } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:top-6"
    >
      <nav
        className={cn(
          "flex h-14 w-full max-w-4xl items-center justify-between gap-4 rounded-full border pr-2 pl-5 backdrop-blur-xl transition-[background-color,border-color,box-shadow,color] duration-300",
          scrolled
            ? "border-border bg-white"
            : "border-white/20 bg-white text-white",
        )}
      >
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark className="size-8" />
          <span className="text-black">PetraPay</span>
        </Link>
        <div className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3 py-1.5 transition-colors",
                scrolled ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-black/75 hover:bg-black/10",
              )}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {status !== "authed" ? (
            <Link
              href="/login?mode=restore"
              className={cn(
                "hidden rounded-full px-3 py-1.5 text-sm transition-colors sm:inline-flex text-muted-foreground hover:text-foreground"
              )}
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href={status === "authed" ? "/dashboard" : "/login"}
            className={cn(
              "press group inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors bg-primary text-primary-foreground"
            )}
          >
            {status === "authed" ? "Dashboard" : "Get started"}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
