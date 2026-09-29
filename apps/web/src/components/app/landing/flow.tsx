"use client";

import { Lock, ShieldCheck, Zap } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { LogoMark } from "../logo";
import { TokenIcon } from "../token-icon";
import { Accent, Reveal, SectionHeading } from "./reveal";

// Layout in a 1000 x 380 coordinate space, shared by the SVG beams and the HTML nodes.
const W = 1000;
const H = 380;
const SOURCES = [
  { symbol: "USDC", chain: "base", label: "USDC", sub: "on Base", y: 80 },
  { symbol: "SOL", chain: "sol", label: "SOL", sub: "on Solana", y: 190 },
  { symbol: "ETH", chain: "arb", label: "ETH", sub: "on Arbitrum", y: 300 },
];
const SOURCE_RIGHT = 230;
const HUB = { x: 500, y: 190, r: 64 };
const WALLET_LEFT = 760;

function inPath(y: number) {
  return `M ${SOURCE_RIGHT} ${y} C ${SOURCE_RIGHT + 130} ${y}, ${HUB.x - HUB.r - 110} ${HUB.y}, ${HUB.x - HUB.r} ${HUB.y}`;
}
const OUT_PATH = `M ${HUB.x + HUB.r} ${HUB.y} L ${WALLET_LEFT} ${HUB.y}`;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

const STEPS = [
  { icon: Zap, title: "Client pays on their chain", body: "A signed quote gives them a one-time deposit address. Any token, any wallet or exchange." },
  { icon: LogoMark, title: "Solvers compete to fill it", body: "Market makers race to swap it into ZEC at the best price. No bridges to babysit." },
  { icon: ShieldCheck, title: "It lands shielded", body: "ZEC arrives in your Orchard pool at an address only that invoice ever used." },
];

export function Flow() {
  const reduce = useReducedMotion();
  return (
    <section id="flow" className="scroll-mt-28 bg-[linear-gradient(180deg,#fff_0%,#f7f6fd_100%)] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          align="center"
          eyebrow=""
          title={
            <>
              One link. Any chain. <Accent>Shielded on arrival.</Accent>
            </>
          }
          body="PetraPay requests a signed quote from a decentralized swap network. Funds move straight from your client's wallet to yours. Nothing sits with us."
        />

        {/* Desktop diagram */}
        <Reveal className="relative mx-auto mt-16 hidden max-w-5xl md:block" delay={0.1}>
          <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
              <defs>
                {/* userSpaceOnUse: straight paths have a zero-height bounding box, which breaks bbox gradients. */}
                <linearGradient id="beam-in" gradientUnits="userSpaceOnUse" x1={SOURCE_RIGHT} y1="0" x2={HUB.x - HUB.r} y2="0">
                  <stop offset="0%" stopColor="#072ac8" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#072ac8" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="beam-out" gradientUnits="userSpaceOnUse" x1={HUB.x + HUB.r} y1="0" x2={WALLET_LEFT} y2="0">
                  <stop offset="0%" stopColor="#072ac8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#d4a54a" stopOpacity="0.8" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" />
                </filter>
              </defs>
              {SOURCES.map((s) => (
                <path key={s.y} id={`in-${s.y}`} d={inPath(s.y)} fill="none" stroke="url(#beam-in)" strokeWidth="2" strokeDasharray="4 6" />
              ))}
              <path id="out" d={OUT_PATH} fill="none" stroke="url(#beam-out)" strokeWidth="2.5" />
              {!reduce
                ? SOURCES.map((s, i) => (
                  <g key={`dot-${s.y}`}>
                    <circle r="7" fill="#072ac8" filter="url(#glow)" opacity="0.7">
                      <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${i * 0.55}s`}>
                        <mpath href={`#in-${s.y}`} />
                      </animateMotion>
                    </circle>
                    <circle r="3.5" fill="#072ac8">
                      <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${i * 0.55}s`}>
                        <mpath href={`#in-${s.y}`} />
                      </animateMotion>
                    </circle>
                  </g>
                ))
                : null}
              {!reduce ? (
                <g>
                  <circle r="9" fill="#f0c56a" filter="url(#glow)" opacity="0.8">
                    <animateMotion dur="1.6s" repeatCount="indefinite">
                      <mpath href="#out" />
                    </animateMotion>
                  </circle>
                  <circle r="4.5" fill="#d4a54a">
                    <animateMotion dur="1.6s" repeatCount="indefinite">
                      <mpath href="#out" />
                    </animateMotion>
                  </circle>
                </g>
              ) : null}
            </svg>

            {SOURCES.map((s) => (
              <div
                key={s.label}
                className="absolute flex -translate-y-1/2 items-center gap-3 rounded-2xl border border-border bg-white p-2.5 pr-5 shadow-[0_8px_24px_-12px_rgba(17,15,36,0.18)]"
                style={{ left: 0, top: pct(s.y, H), width: pct(SOURCE_RIGHT, W) }}
              >
                <TokenIcon symbol={s.symbol} chain={s.chain} size={36} />
                <div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </div>
            ))}

            <div
              className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: pct(HUB.x, W), top: pct(HUB.y, H), width: pct(HUB.r * 2, W), aspectRatio: "1" }}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s]" />
              <span className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(106,76,255,0.25),transparent_70%)]" />
              <span className="relative grid size-full place-items-center rounded-full bg-gradient-to-br from-[#4b36e0] to-[#2a1a9e] text-white shadow-[0_20px_40px_-12px_rgba(59,40,204,0.6)] ring-4 ring-white">
                <span className="text-center text-[11px] leading-tight font-semibold">
                  Smart
                  <br />
                  routing
                </span>
              </span>
            </div>

            <div
              className="absolute -translate-y-1/2 rounded-3xl bg-[#0b0a24] p-5 text-white shadow-[0_24px_48px_-16px_rgba(11,10,36,0.55)]"
              style={{ left: pct(WALLET_LEFT, W), top: pct(HUB.y, H), width: pct(W - WALLET_LEFT, W) }}
            >
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Your wallet</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f5deb0]/15 px-2 py-0.5 text-[#f5deb0]">
                  <Lock className="size-3" /> Orchard
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight tabular">
                ●●●●●● <span className="text-base text-white/60">ZEC</span>
              </p>
              <p className="mt-1 text-xs text-white/50">Invisible to block explorers</p>
            </div>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <div className="group h-full rounded-3xl border border-border bg-white p-6 transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
