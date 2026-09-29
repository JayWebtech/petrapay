"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Fades and lifts content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className, y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, body, align = "left" }: { eyebrow: string; title: ReactNode; body?: ReactNode; align?: "left" | "center" }) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">{body}</p> : null}
    </Reveal>
  );
}

/** Indigo-to-violet emphasis for a few words inside a heading. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}
