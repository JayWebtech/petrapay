"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExpandingArrowButton } from "@/components/motion/expanding-arrow-button";
import closingImage from "../../../../public/bg-3.png";
import { LogoMark } from "../logo";
import { Reveal } from "./reveal";

/** Closing band on the second artwork: sky on top for copy, the lit field below. */
export function ClosingCta() {
  const router = useRouter();
  return (
    <section className="px-2 md:px-3">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#001a62] md:rounded-[40px]">
        <Image src={closingImage} alt="" fill placeholder="blur" sizes="100vw" className="-z-10 object-cover object-[50%_78%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#001a62]/70 via-transparent via-55% to-transparent" />
        <Reveal className="mx-auto flex min-h-[560px] max-w-5xl flex-col items-center px-6 pt-20 text-center text-white md:min-h-[680px] md:pt-24">
          <h2 className="text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance md:text-[3.6rem]">
            Your work is public.
            <br />
            <span className="bg-gradient-to-b from-[#fff4dc] to-[#f0b86a] bg-clip-text text-transparent">Your wallet doesn&apos;t have to be.</span>
          </h2>
          <p className="mt-6 max-w-md text-white/75 md:text-lg">Create an account in 20 seconds. No email, no KYC, nothing to custody.</p>
          <div className="mt-9">
            <ExpandingArrowButton
              onClick={() => router.push("/login")}
              className="h-14 min-w-64 rounded-[20px] bg-white text-[#110f24] focus-visible:ring-white"
              accentClassName="bg-[#f5deb0]"
              labelClassName="text-base"
            >
              Send your first invoice
            </ExpandingArrowButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-20 pb-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="size-7" /> PetraPay
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Privacy-first invoicing for creators. Cross-chain swaps, privacy by Zcash. Non-custodial by design.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Product</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><a href="#flow" className="hover:text-foreground">How it works</a></li>
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
            <li><a href="#privacy" className="hover:text-foreground">Privacy</a></li>
            <li><Link href="/login" className="hover:text-foreground">Get started</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Built on</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><a href="https://z.cash" target="_blank" rel="noreferrer" className="hover:text-foreground">Zcash</a></li>
            <li><a href="https://zashi.app" target="_blank" rel="noreferrer" className="hover:text-foreground">Zashi wallet</a></li>
          </ul>
        </div>
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.2em] bg-gradient-to-b from-[#dcd6fb] via-[#efecfd] to-white bg-clip-text text-center text-[21vw] leading-none font-semibold tracking-[-0.06em] text-transparent select-none"
      >
        PetraPay
      </p>
    </footer>
  );
}
