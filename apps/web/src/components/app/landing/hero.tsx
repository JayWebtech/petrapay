"use client";

import { Lock } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ExpandingArrowButton } from "@/components/motion/expanding-arrow-button";
import { cn } from "@/lib/utils";
import heroImage from "../../../../public/bg-4.png";

const EASE = [0.16, 1, 0.3, 1] as const;
const LINE_ONE = ["Get", "paid", "in", "any", "token."];
const LINE_TWO = ["Keep", "it", "shielded."];

/** Word-by-word reveal. `wordClassName` applies per word so gradient text survives each word's own transform layer. */
function Words({ words, delay, wordClassName }: { words: string[]; delay: number; wordClassName?: string }) {
  const reduce = useReducedMotion();
  return (
    <span>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className={cn("inline-block pb-[0.08em] will-change-transform", wordClassName)}
          initial={reduce ? false : { opacity: 0, y: "0.4em", filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: delay + i * 0.07, ease: EASE }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * The artwork's night sky (#0b398a) is extended upward in solid navy so the copy always sits on sky,
 * and the path with its lone walker stays visible below. The artwork drifts slower than the page.
 */
export function Hero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const artY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "12%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-18%"]);

  return (
    <section className="px-2 pt-2 md:px-3 md:pt-3">
      <div ref={ref} className="relative isolate overflow-hidden rounded-[28px] md:rounded-[40px]" style={{ minHeight: "92vh" }}>
        {/* Background hero image */}
        <motion.div style={{ y: artY }} className="absolute inset-0 -z-20">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>

        {/* Dark overlay for text legibility */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0b1a3a]/80 via-[#0b1a3a]/50 to-transparent" />

        {/* Soft starfield and glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent), radial-gradient(1px 1px at 78% 12%, #fff 50%, transparent), radial-gradient(1.5px 1.5px at 64% 30%, #fff 50%, transparent), radial-gradient(1px 1px at 30% 36%, #fff 50%, transparent), radial-gradient(1px 1px at 88% 40%, #fff 50%, transparent), radial-gradient(1px 1px at 22% 8%, #fff 50%, transparent), radial-gradient(60% 40% at 50% 0%, rgba(155,123,255,0.35), transparent 70%)",
          }}
        />

        <motion.div style={{ y: copyY }} className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-32 text-center text-white md:pt-40">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pr-3 pl-1 text-xs text-white/85 backdrop-blur-md"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5deb0] px-2 py-0.5 font-medium text-[#1b1440]">
              <Lock className="size-3" /> New
            </span>
            Shielded ZEC settlement
          </motion.span>

          <h1 className="mt-7 text-[2.6rem] leading-[1] font-semibold tracking-[-0.045em] sm:text-6xl md:text-[5.5rem]">
            <Words words={LINE_ONE} delay={0.1} />
            <br />
            <Words words={LINE_TWO} delay={0.45} wordClassName="bg-gradient-to-b from-[#fff4dc] to-[#e9c98c] bg-clip-text text-transparent" />
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
            className="mt-7 max-w-xl text-base leading-relaxed text-pretty text-white/75 md:text-lg"
          >
            Stripe-simple invoicing for creators who work in public but bank in private. Clients pay with whatever they hold, on any chain.
            You receive shielded Zcash.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <ExpandingArrowButton
              onClick={() => router.push("/login")}
              className="h-14 min-w-64 rounded-[20px] bg-white text-[#110f24] focus-visible:ring-white"
              accentClassName="bg-[#f5deb0]"
              labelClassName="text-base"
            >
              Start invoicing free
            </ExpandingArrowButton>
            <a
              href="#flow"
              className="press inline-flex h-14 items-center rounded-[20px] border border-white/20 bg-white/5 px-6 text-base font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
