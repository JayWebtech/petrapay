import { ZEC_ASSET_ID, type TokenDTO } from "@petrapay/shared";
import { Check, Printer, QrCode, ShieldCheck, Store } from "lucide-react";
import { Bento, type PriceToken } from "@/components/app/landing/bento";
import { CheckoutMock } from "@/components/app/landing/checkout-mock";
import { ClosingCta, LandingFooter } from "@/components/app/landing/closing";
import { Faq } from "@/components/app/landing/faq";
import { Flow } from "@/components/app/landing/flow";
import { Hero } from "@/components/app/landing/hero";
import { VideoDemo } from "@/components/app/landing/video-demo";
import { LandingNav } from "@/components/app/landing/landing-nav";
import { PosShowcase } from "@/components/app/landing/pos-showcase";
import { PrivacyViews } from "@/components/app/landing/privacy-views";
import { Accent, Reveal, SectionHeading } from "@/components/app/landing/reveal";
import { TiltShowcase } from "@/components/app/landing/tilt-showcase";
import { TokenMarquee, type MarqueeToken } from "@/components/app/landing/token-marquee";
import { serverApiCached } from "@/lib/api";

// Token list and prices come from our routing API, refreshed every 5 minutes.
export const revalidate = 300;

const MARQUEE_PAIRS: [string, string][] = [
  ["USDC", "base"], ["SOL", "sol"], ["USDT", "tron"], ["ETH", "eth"], ["BTC", "btc"], ["USDC", "sol"],
  ["ETH", "base"], ["BNB", "bsc"], ["wNEAR", "near"], ["XRP", "xrp"], ["DOGE", "doge"], ["TON", "ton"],
  ["SUI", "sui"], ["AVAX", "avax"], ["USDT", "eth"], ["ETH", "arb"], ["LTC", "ltc"], ["ADA", "cardano"],
  ["XLM", "stellar"], ["APT", "aptos"], ["USDC", "arb"], ["ETH", "op"], ["cbBTC", "base"], ["TRX", "tron"],
  ["BCH", "bch"], ["USDC", "eth"], ["DASH", "dash"], ["POL", "pol"],
];
const ESTIMATOR_PAIRS: [string, string][] = [["USDC", "base"], ["SOL", "sol"], ["ETH", "base"], ["BTC", "btc"], ["USDT", "tron"]];

const POS_POINTS = [
  { icon: Store, title: "Pair a terminal in seconds.", body: "Enter a one-time code from your dashboard. Each terminal can only take payments: no withdrawals, no settings." },
  { icon: QrCode, title: "Type the amount, show the QR.", body: "Customers scan with their phone and pay with any token, or shielded ZEC." },
  { icon: Printer, title: "The receipt prints itself.", body: "As soon as the payment lands. Built for Android terminals with a printer, like the Senraise H10." },
  { icon: ShieldCheck, title: "Every sale lands shielded.", body: "Each one settles to a fresh Orchard address, so your takings stay private." },
];

const CLIENT_POINTS = [
  { title: "Pays with what they hold.", body: "Search 190+ tokens and see the exact amount, fees included, before committing." },
  { title: "One click from a wallet.", body: "MetaMask, Rabby, Phantom and friends, or scan a QR from any app or exchange." },
  { title: "Always refundable.", body: "Every quote is atomic and refunds to their own address if it can't complete." },
];

function pick(tokens: TokenDTO[], pairs: [string, string][]) {
  return pairs
    .map(([symbol, chain]) => tokens.find((t) => t.symbol === symbol && t.blockchain === chain))
    .filter((t): t is TokenDTO => !!t);
}

export default async function LandingPage() {
  const tokens = (await serverApiCached<TokenDTO[]>("/tokens", revalidate)) ?? [];

  const marquee: MarqueeToken[] = tokens.length
    ? pick(tokens, MARQUEE_PAIRS).map((t) => ({ symbol: t.symbol, chain: t.blockchain }))
    : MARQUEE_PAIRS.map(([symbol, chain]) => ({ symbol, chain }));
  const estimator: PriceToken[] = pick(tokens, ESTIMATOR_PAIRS).map((t) => ({ symbol: t.symbol, chain: t.blockchain, priceUsd: t.priceUsd }));
  const zecPrice = tokens.find((t) => t.assetId === ZEC_ASSET_ID)?.priceUsd ?? null;
  // Round down so the headline never overstates what's live.
  const tokenCount = tokens.length ? Math.floor(tokens.length / 10) * 10 : 100;
  const chainCount = tokens.length ? new Set(tokens.map((t) => t.blockchain)).size : 25;

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <VideoDemo />
        <TokenMarquee tokens={marquee} tokenCount={tokenCount} chainCount={chainCount} />
        <Flow />

        {/* The checkout */}
        <section id="checkout" className="mx-auto scroll-mt-28 grid max-w-6xl items-center gap-14 px-5 py-24 md:grid-cols-[1fr_1.05fr] md:py-32">
          <div>
            <SectionHeading
              eyebrow="The checkout"
              title={
                <>
                  Your client sees a checkout, <Accent>not a crypto puzzle.</Accent>
                </>
              }
            />
            <Reveal delay={0.1}>
              <ul className="mt-8 space-y-5 text-[15px]">
                {CLIENT_POINTS.map((point) => (
                  <li key={point.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-white">
                      <Check className="size-3.5" />
                    </span>
                    <span>
                      <span className="font-medium">{point.title}</span>
                      <span className="text-muted-foreground"> {point.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={0.15}>
            <TiltShowcase>
              <CheckoutMock />
            </TiltShowcase>
          </Reveal>
        </section>

        {/* Point of sale */}
        <section id="pos" className="scroll-mt-28 bg-[linear-gradient(180deg,#fff_0%,#f7f6fd_100%)]">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 md:grid-cols-[1.05fr_1fr] md:py-32">
            <Reveal delay={0.15} className="order-2 md:order-1">
              <PosShowcase />
            </Reveal>
            <div className="order-1 md:order-2">
              <SectionHeading
                eyebrow="Point of sale"
                title={
                  <>
                    Take shielded payments <Accent>at the counter.</Accent>
                  </>
                }
                body="PetraPay POS turns an Android payment terminal into a private till. Same checkout your customers use online, with a printed receipt."
              />
              <Reveal delay={0.1}>
                <ul className="mt-8 space-y-5 text-[15px]">
                  {POS_POINTS.map((point) => (
                    <li key={point.title} className="flex gap-3">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#eef1fd] text-primary">
                        <point.icon className="size-4" />
                      </span>
                      <span>
                        <span className="font-medium">{point.title}</span>
                        <span className="text-muted-foreground"> {point.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* <Bento tokens={estimator} zecPrice={zecPrice} /> */}
        {/* <PrivacyViews /> */}

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-28 gap-10 px-5 py-24 md:grid-cols-[0.8fr_1.2fr] md:py-32">
          <SectionHeading eyebrow="FAQ" title="Questions, answered." body="Still curious? Everything PetraPay does is non-custodial and verifiable on-chain." />
          <Reveal delay={0.1}>
            <Faq />
          </Reveal>
        </section>

        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
