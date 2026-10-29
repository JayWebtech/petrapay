"use client";

import { Play } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";

const VIMEO_ID = "1240767672";

/**
 * Full-width video demo section. Shows a cinematic thumbnail with a play
 * button; clicking it lazy-loads the Vimeo iframe so the page stays fast.
 */
export function VideoDemo() {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const play = useCallback(() => setPlaying(true), []);

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Demo
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">
          See PetraPay in action
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
          Watch how a creator sends an invoice and a client pays with any
          token&mdash;settled as shielded ZEC in seconds.
        </p>
      </motion.div>

      <motion.div
        ref={wrapRef}
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-12 overflow-hidden rounded-2xl border border-border/60 bg-black shadow-2xl md:rounded-3xl"
        style={{ aspectRatio: "16/9" }}
      >
        {playing ? (
          <iframe
            src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`}
            className="absolute inset-0 size-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="PetraPay demo video"
          />
        ) : (
          <button
            type="button"
            onClick={play}
            className="group absolute inset-0 flex size-full cursor-pointer items-center justify-center bg-gradient-to-br from-[#0b1a3a] via-[#13103a] to-[#1a0e2e] transition-colors hover:from-[#0f2050] hover:via-[#1a1450] hover:to-[#221240]"
            aria-label="Play demo video"
          >
            {/* Decorative glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(60% 50% at 50% 50%, rgba(155,123,255,0.25), transparent 70%)",
              }}
            />

            {/* Play icon */}
            <span className="relative z-10 flex size-20 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl transition-transform duration-300 group-hover:scale-110 md:size-24">
              <Play className="ml-1 size-8 fill-white text-white md:size-10" />
            </span>

            {/* Label */}
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm font-medium text-white/60 transition-colors group-hover:text-white/80 md:bottom-8 md:text-base">
              Watch the demo
            </span>
          </button>
        )}
      </motion.div>
    </section>
  );
}
