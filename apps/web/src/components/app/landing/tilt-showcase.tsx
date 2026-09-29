"use client";

import type { ReactNode } from "react";
import { TiltCard } from "@/components/motion/tilt-card";

/** Soft glow stage with a gently tilting card on hover. */
export function TiltShowcase({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(106,76,255,0.22),transparent)] blur-2xl" />
      <TiltCard max={6} glare={false} className="rounded-[28px]">
        {children}
      </TiltCard>
    </div>
  );
}
