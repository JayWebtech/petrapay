"use client";

import { BouncyAccordion } from "@/components/motion/bouncy-accordion";

const ITEMS = [
  {
    id: "custody",
    title: "Does PetraPay ever hold my money?",
    description:
      "No. Each checkout requests a signed quote with a one-time deposit address from a decentralized swap network. Your client's funds go from their wallet to that address, solvers swap them, and ZEC is delivered straight to your shielded address. PetraPay only coordinates and tracks status.",
  },
  {
    id: "wallet",
    title: "Which Zcash wallet do I need?",
    description:
      "Any wallet that gives you a unified address with an Orchard receiver (starts with u1), such as Zashi. Add a handful of addresses to your pool so every invoice gets its own. Sapling-only and transparent addresses aren't accepted.",
  },
  {
    id: "visible",
    title: "What can people see on-chain?",
    description:
      "The payer's deposit on their chain is public, and the swap network's public explorer shows a swap into ZEC for a shielded recipient. Because each invoice uses a fresh address, those swaps can't be tied together or to your balance. After settlement, the ZEC is in the Orchard shielded pool.",
  },
  {
    id: "account",
    title: "Why no email or password?",
    description:
      "Your account is an ed25519 key derived from a 12-word recovery phrase that never leaves your browser. There's nothing to leak, and signing in on a new device just takes the phrase.",
  },
  {
    id: "withdraw",
    title: "How do I cash out?",
    description:
      "From the dashboard, choose a token and chain, enter where it should go, and scan the ZEC deposit QR with your wallet. The same swap network converts your ZEC, with refunds going back to your shielded address if anything fails.",
  },
  {
    id: "fees",
    title: "What does it cost?",
    description:
      "Network and solver fees are baked into the quote your client sees before paying. The creator receives the exact ZEC amount quoted for the invoice.",
  },
];

export function Faq() {
  return <BouncyAccordion items={ITEMS} />;
}
