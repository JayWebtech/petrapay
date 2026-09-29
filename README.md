# PetraPay

Privacy-first, cross-chain invoicing for creators. A freelancer sends a payment link; the client pays with whatever they hold (USDC on Base, SOL, ETH, BTC, USDT on Tron and 100+ other assets); [NEAR Intents](https://docs.near-intents.org) swaps it and settles **shielded ZEC** straight to the creator's Zcash wallet. Creators can later swap ZEC back out to any supported chain.

The platform is non-custodial: it never holds keys or funds. It coordinates quotes and tracks their status.

```
Client wallet ──(USDC on Base)──▶ 1Click deposit address ──▶ NEAR Intents solvers ──▶ Orchard address (per invoice)
                                  (signed quote, refundable)                          in the creator's Zashi wallet
```

## Features

**Creators**
- Account = an ed25519 key derived from a 12-word recovery phrase. No email, password, or wallet linkage. The key lives in the browser as a non-extractable WebCrypto key.
- **Shielded address pool.** Paste unified addresses from Zashi. Each invoice takes a fresh one, so the payments NEAR Intents' public explorer shows can't be linked to each other.
- Invoices in USD or ZEC with line items, due dates, notes and a shareable link + QR. Open invoices can be edited; the total is frozen while a client holds a live quote for it.
- **Bill to:** optional client name and email, shown on the payment page. "Email invoice" opens the creator's own mail app with the link.
- **End-to-end encrypted client notes.** The private "client" field is AES-GCM encrypted in the browser with a key derived from the recovery phrase. The server stores only `enc1:…` ciphertext.
- **Payment links** (`/l/<id>`): reusable links with a fixed price or a payer-chosen amount (optional min/max and suggested amounts), plus up to 8 custom form fields (text, email, phone, long text, dropdown). Each payer's checkout becomes its own invoice on a fresh shielded address. Answers are sealed in the payer's browser to the creator's X25519 key (derived from the recovery phrase; `box1:` = ephemeral ECDH + HKDF-SHA256 + AES-GCM), so the server only stores ciphertext. Links can be paused.
- Live dashboard: shielded ZEC received, outstanding, 30-day chart, payment attempts per invoice.
- **Withdrawals:** swap ZEC → any token on any NEAR Intents chain. The UI shows a ZIP-321 QR for Zashi; refunds go back to a shielded address.

**Payers**
- Pick any token from 100+ assets. See a live quote (amount, USD value, ETA) before committing.
- One-click **Pay with wallet** for EVM chains (MetaMask, Rabby…) and Solana (Phantom, Solflare, Backpack), or scan an EIP-681 / Solana Pay / BIP-21 QR, or copy the address.
- Progress tracker (deposit → swap → delivered), resumable after reload, with refund handling.
- **Pay in ZEC directly** via a ZIP-321 QR to the invoice's shielded address.

## Privacy model

| Visible publicly | Stays private |
| --- | --- |
| The payer's deposit on their own chain | The creator's shielded balance and total earnings |
| A NEAR Intents swap into ZEC for a single-use shielded recipient | Which invoices belong to the same creator |
| For withdrawals: the ZEC amount sent to the bridge's one-time transparent address | Where ZEC goes after it lands, and the client list |

What the PetraPay server knows: invoice titles, amounts and line items (the payer page needs them), the creator's display name and address pool, and payers' refund addresses. It does **not** know client names (end-to-end encrypted), creators' identities, or anything about their wallets beyond the receiving addresses they upload.

Set `ONECLICK_CONFIDENTIALITY=basic|advanced` (requires a 1Click partner JWT) to route swaps through **Confidential Intents**, which also breaks the link between the payer's deposit and the ZEC delivery on NEAR Intents itself.

### How ZEC settlement works (verified against the live API)

The NEAR Intents docs list ZEC as "transparent only", but the 1Click API currently **accepts unified addresses with an Orchard receiver** as ZEC recipients, including Orchard-only ones. It rejects Sapling-only unified addresses and raw `zs` addresses. PetraPay decodes every unified address in the browser and on the server (bech32m + F4Jumble per ZIP-316, tested against the official vectors) and only accepts ones with an Orchard receiver. This was verified with dry and live quotes, not yet with a funded end-to-end payment.

## Architecture

```
packages/shared   Zcash address decoding (ZIP-316), ZIP-321 URIs, amount math, chain metadata, zod schemas, DTO types
apps/api          Fastify + Prisma 7 + Postgres. Auth, invoices, address pool, 1Click quotes, status worker
apps/web          Next.js 16 (App Router) + Tailwind v4 + beUI components. Landing, dashboard, checkout
```

- **1Click integration** (`apps/api/src/services/oneclick.ts`) uses the official `@defuse-protocol/one-click-sdk-typescript`. Every quote's signature is checked with `verifyQuoteSignature`, and the echoed request (recipient, assets, refund address) must match what was asked for before a deposit address is shown.
- Invoice payments are `EXACT_OUTPUT` quotes, so the creator receives the exact ZEC amount (USD invoices convert at 1Click's ZEC price when the payer requests the quote). Withdrawals are `EXACT_INPUT`.
- A **background worker** (`apps/api/src/worker.ts`) polls `/v0/status` for open deposit addresses and moves invoices through `OPEN → PROCESSING → PAID`. Payment pages also refresh on read. It's safe to run several API instances.
- Address pool assignment uses `SELECT … FOR UPDATE SKIP LOCKED`, so concurrent invoices never share a fresh address.
- The web app proxies `/api/*` to the API, so the session cookie (`httpOnly`, `SameSite=Lax`) stays first-party.

## Getting started

Requirements: Node ≥ 20.19, pnpm 9, Docker (for Postgres).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
pnpm db:migrate
pnpm dev            # API on :4000, web on :3000
```

Open http://localhost:3000, create an account, add a few unified addresses from Zashi (Receive → copy, repeat), and create an invoice.

> There is no NEAR Intents testnet. Quotes and deposit addresses are real mainnet ones; test with small amounts.

### Configuration (`apps/api/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `APP_ORIGIN` | Web origin, for CORS |
| `ONECLICK_JWT` | Partner JWT from [partners.near-intents.org](https://partners.near-intents.org). Without it, 1Click adds a 0.25% fee |
| `ONECLICK_CONFIDENTIALITY` | `public` (default), `basic` or `advanced`. Non-public needs `ONECLICK_JWT` |
| `SLIPPAGE_BPS` | Quote slippage in basis points (default 100) |
| `APP_FEE_BPS` / `APP_FEE_RECIPIENT` | Optional platform fee and the NEAR account that receives it |
| `POLL_INTERVAL_MS` / `WORKER_ENABLED` | Status worker cadence / toggle |

Web: `API_URL` (where `/api` is proxied) and `NEXT_PUBLIC_SOLANA_RPC_URL` (use a real RPC provider in production; the public endpoint rate-limits browsers).

### Tests

```bash
pnpm test        # shared: ZIP-316 vectors, amounts; api: auth, address pool, privacy, settlement state
pnpm typecheck
```

API tests run against a separate `petrapay_test` database, created and migrated automatically.

### Self-hosting

Anyone can run their own instance; creators' funds never touch the operator.

```bash
cp apps/api/.env.example apps/api/.env   # set ONECLICK_JWT etc.
docker compose --profile app up -d --build
```

This starts Postgres, the API (running migrations on boot) and the web app on port 3000. Put it behind an HTTPS reverse proxy (Caddy, nginx, a load balancer) and set `COOKIE_SECURE=true` and `APP_ORIGIN`. The proxy must set `X-Forwarded-For`: the Next.js `/api` rewrite passes it through but doesn't add it, and the API's per-IP rate limits depend on it. Keep the API itself off the public internet, as the compose file does.

## Known limitations and next steps

- **Payer refund address is required** for cross-chain payments (1Click refunds on the origin chain). Connecting a wallet fills it in automatically.
- **Direct ZEC payments can't be auto-confirmed.** Shielded transfers are invisible without a viewing key, so the payer taps "I've sent it" and the creator marks the invoice paid. A future option: let the creator register an Orchard *incoming* viewing key in a local-only scanner.
- **Withdrawals send to a transparent bridge address**, so that one amount is public (its shielded origin is not).
- Invoice content (title, line items) is readable by the server. A next step is encrypting it with a key carried in the link's URL fragment, so only the creator and the payer can read it.
- Reusable payment links (tip jars, fixed-price products) and email/webhook notifications aren't built yet.
- EVM "Pay with wallet" uses the injected provider (`window.ethereum`). Adding WalletConnect would cover mobile wallets.
