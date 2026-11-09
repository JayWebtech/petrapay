/** The docs' structure: groups and pages in reading order. Content lives in ./pages. */

export type DocPage = {
  /** Path under /docs; "" is the introduction. */
  slug: string;
  title: string;
  description: string;
  /** Extra words for search. */
  keywords?: string[];
  /** Shown next to the title in the sidebar, e.g. an HTTP method. */
  badge?: string;
};

export type DocGroup = { title: string; pages: DocPage[] };

export const DOCS: DocGroup[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "", title: "Introduction", description: "Accept payments in any token and receive shielded Zcash, without holding anyone's funds." },
      { slug: "quickstart", title: "Quickstart", description: "Go from a new account to your first paid checkout in five minutes.", keywords: ["setup", "start", "begin"] },
      { slug: "concepts", title: "How PetraPay works", description: "Checkouts, shielded addresses, quotes and settlement, explained.", keywords: ["architecture", "settlement", "swap"] },
    ],
  },
  {
    title: "Accept payments",
    pages: [
      { slug: "invoices", title: "Invoices", description: "Bill a client for work, with line items, due dates and a payment page.", keywords: ["bill", "client", "freelance"] },
      { slug: "payment-links", title: "Payment links", description: "One reusable link for products, tips and donations, with custom form fields.", keywords: ["donation", "tip", "product", "form"] },
      { slug: "checkout", title: "The checkout", description: "What your customers see, and every way they can pay.", keywords: ["customer", "pay", "wallet", "qr"] },
      { slug: "point-of-sale", title: "Point of sale", description: "Take in-person payments on an Android terminal and print receipts.", keywords: ["pos", "terminal", "receipt", "printer", "h10", "store"] },
      { slug: "withdrawals", title: "Withdrawals", description: "Convert your ZEC to any token, on any supported chain.", keywords: ["cash out", "off-ramp", "convert"] },
    ],
  },
  {
    title: "Developers",
    pages: [
      { slug: "api", title: "API overview", description: "Base URL, authentication, errors, idempotency and pagination.", keywords: ["rest", "key", "auth", "errors"] },
      { slug: "api/checkouts", title: "Checkouts", description: "Create a hosted payment page from your server and track its status.", keywords: ["create checkout", "order"] },
      { slug: "api/payment-links", title: "Payment links API", description: "Create, list and pause payment links programmatically." },
      { slug: "webhooks", title: "Webhooks", description: "Get notified the moment a checkout is paid, expired or cancelled.", keywords: ["events", "notifications", "callback"] },
      { slug: "webhooks/signatures", title: "Verifying signatures", description: "Check that a webhook really came from PetraPay.", keywords: ["hmac", "security", "verify"] },
      { slug: "testing", title: "Testing", description: "Try the full flow, from checkout to receipt, without moving real money.", keywords: ["test mode", "simulate", "sandbox"] },
    ],
  },
  {
    title: "Resources",
    pages: [
      { slug: "privacy", title: "Privacy model", description: "What stays private, what is public, and why.", keywords: ["shielded", "orchard", "security"] },
      { slug: "fees", title: "Fees", description: "What customers pay and what you receive.", keywords: ["pricing", "cost"] },
      { slug: "self-hosting", title: "Self-hosting", description: "Run your own PetraPay instance.", keywords: ["deploy", "railway", "vercel", "open source"] },
      { slug: "faq", title: "FAQ", description: "Answers to common questions." },
    ],
  },
];

export const ALL_PAGES: (DocPage & { group: string })[] = DOCS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.title })));

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export function findPage(slug: string) {
  const i = ALL_PAGES.findIndex((p) => p.slug === slug);
  return i === -1 ? null : { page: ALL_PAGES[i]!, prev: ALL_PAGES[i - 1] ?? null, next: ALL_PAGES[i + 1] ?? null };
}
