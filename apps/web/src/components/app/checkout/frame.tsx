"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { LogoMark } from "@/components/app/logo";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Two-column checkout: the panel on the left (stacked on top below lg), and the current step
 * on the right, which slides and blurs between steps keyed by `stage`.
 */
export function CheckoutFrame({ panel, stage, children, overlay }: { panel: ReactNode; stage: string; children: ReactNode; overlay?: ReactNode }) {
  const reduce = useReducedMotion();
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // A new step starts at its top: bring it into view if the payer had scrolled past it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [stage, reduce]);

  return (
    <div className="min-h-screen bg-white p-2 sm:p-3 lg:grid lg:h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-3 lg:overflow-hidden">
      {panel}

      <main className="flex min-h-full flex-col lg:overflow-y-auto">
        <div className="flex flex-1 items-start justify-center px-3 pt-8 pb-8 sm:px-8 sm:pt-10 lg:items-center lg:py-14">
          <div ref={top} className="w-full max-w-[440px] scroll-mt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stage}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, filter: "blur(6px)" }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="flex items-center justify-center gap-1.5 pb-6 text-xs text-muted-foreground">
          <LogoMark className="size-4" /> Secured by PetraPay · Non-custodial routing
        </p>
      </main>

      {overlay}
    </div>
  );
}
