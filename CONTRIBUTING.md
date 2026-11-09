# Contributing to PetraPay

Thanks for your interest in PetraPay. It moves real money and makes privacy promises to the people who use it, so we hold contributions to a high standard. These guidelines follow the [`librustzcash` contribution guide](https://github.com/zcash/librustzcash/blob/main/CONTRIBUTING.md), adapted to a TypeScript monorepo.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Reporting security issues](#reporting-security-issues)
- [How to contribute](#how-to-contribute)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Design principles](#design-principles)
- [Styleguides](#styleguides)
  - [Code style](#code-style)
  - [Testing](#testing)
  - [Commit messages](#commit-messages)
- [Branch history](#branch-history)
- [Pull request review](#pull-request-review)
- [Merge workflow](#merge-workflow)
- [License](#license)

## Code of conduct

Be respectful and constructive. Critique code, not people. Harassment or abuse of any kind isn't tolerated, and maintainers may remove comments, commits or contributors that break this rule.

## Reporting security issues

**Do not open a public issue for a security vulnerability.** This includes anything that could lose or redirect funds, de-anonymize a merchant or customer, bypass authentication, or forge a webhook.

Report it privately through [GitHub's private vulnerability reporting](https://github.com/JayWebtech/petrapay/security/advisories/new) with a description, steps to reproduce and the impact. We'll acknowledge it within 72 hours and agree on a disclosure timeline with you.

## How to contribute

- **Bugs:** open an issue with what you did, what you expected, what happened, and your environment (browser, Android device, self-hosted or not). Never include recovery phrases, API keys, webhook secrets or terminal tokens.
- **Features:** open an issue to discuss the design before writing a large change. A short proposal saves both sides from a rejected pull request.
- **Small fixes** (typos, docs, obvious bugs) can go straight to a pull request.
- Look for issues labelled `good first issue` if you're new to the codebase.

## Getting started

Requirements: Node.js 20.19+, pnpm 9, and PostgreSQL 15+. The Android POS app also needs JDK 17 and the Android SDK.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # point DATABASE_URL at a local database
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                     # optional: local Postgres via Docker
pnpm db:migrate
pnpm dev                                       # API on :4000, web on :3000
```

> **Never run migrations or tests against a production database.** The test suite resets tables. Always check `DATABASE_URL` first.

The POS app is a separate npm project. See [`apps/pos/README.md`](apps/pos/README.md).

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/api` | Fastify API, Prisma schema and migrations, background worker, tests |
| `apps/web` | Next.js web app: landing page, dashboard, hosted checkout, docs |
| `apps/pos` | React Native Android point-of-sale app with Kotlin native modules |
| `packages/shared` | Zcash utilities (ZIP-316, ZIP-321), API schemas and types shared by API and web |

## Design principles

Every change must keep these properties. If a change weakens one, say so explicitly in the pull request and explain why.

1. **Non-custodial.** PetraPay never holds funds, spending keys or viewing keys. Payments go from the customer, through the swap network, to the merchant's own wallet.
2. **Shielded settlement.** Merchants receive ZEC to Orchard receivers only. Transparent and Sapling-only addresses are rejected.
3. **Unlinkable payments.** Each checkout uses a fresh address from the merchant's pool. Don't add code paths that reuse addresses silently.
4. **Verify before trusting.** Every swap quote's signature is verified, and its echoed recipient, assets and refund address are checked, before a deposit address is shown.
5. **Secrets stay client-side.** Recovery phrases and derived keys never leave the browser. Data encrypted to the merchant's key is never decrypted on the server.
6. **Data minimization.** Don't add analytics, third-party trackers, or logging of addresses, amounts or personal data beyond what's needed to run a checkout. Ask before adding new personal fields, and say whether they're encrypted.
7. **Least privilege.** API keys, terminal tokens and webhooks get only the access they need. A POS terminal can never withdraw or read other sales.

## Styleguides

### Code style

- **TypeScript everywhere**, with `strict` mode. Avoid `any`; use `unknown` and narrow it.
- **Validate at the edges.** Every API request body and query is parsed with a `zod` schema from `packages/shared`. Never trust client input.
- **Amounts are decimal strings or `bigint` base units**, never floating-point numbers.
- **Keep functions small and named for what they do.** Prefer clear code to comments. Comments explain *why*, not *what*.
- **Errors:** API errors use the `{ error: { type, message, param } }` shape on `/v1` routes and `HttpError` internally. Messages should be clear to a merchant and must not leak internals or secrets.
- **Database changes** go through a Prisma migration in `apps/api/prisma/migrations`. Never edit a migration that has shipped; add a new one.
- **Formatting and linting:** match the existing style and run the checks below. Don't mix formatting-only changes with logic changes in one commit.
- **UI text:** plain, specific language. Keep the existing design tokens and components.
- **Dependencies:** add one only when it's clearly worth it, prefer well-audited libraries (e.g. `@noble/*` for cryptography), and never roll your own cryptographic primitives.

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm --filter @petrapay/web lint
pnpm test                       # needs a local DATABASE_URL
(cd apps/pos && npm run lint && npx tsc --noEmit)   # if you changed the POS app
```

### Testing

- Bug fixes come with a test that fails without the fix.
- New API behaviour comes with tests in `apps/api/test`. Cover the failure paths too: bad input, wrong owner, wrong state.
- Zcash encoding changes must keep passing the official ZIP-316 test vectors.
- Anything touching money, settlement state, signatures or authorization needs tests. No exceptions.
- Test against real networks only with test mode or small amounts you control.

### Commit messages

We follow the commit message guidelines of `librustzcash`:

- **Subject line:** imperative mood, at most 72 characters, no trailing period. We use [Conventional Commits](https://www.conventionalcommits.org/) prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Add a scope when it helps, e.g. `fix(api): reject expired pairing codes`.
- **Body:** leave a blank line after the subject, wrap at 72 characters, and explain *what* changed and *why*, not how. Link issues with `Closes #123`.
- **One logical change per commit.** Each commit should build and pass tests on its own, so `git bisect` keeps working.
- Don't leave fix-ups in the final history ("fix typo", "address review"). Squash them into the commit they fix.

```
fix(api): lock the address pool row when assigning to a checkout

Two checkouts created at the same moment could pick the same unused
address, linking them on-chain. Assign with SELECT ... FOR UPDATE SKIP
LOCKED so concurrent requests always get distinct addresses.

Closes #42
```

## Branch history

- Branch from the latest `main` and give the branch a descriptive name, e.g. `fix/pool-race` or `feat/pos-refunds`.
- Keep a clean, linear history. **Rebase on `main`** to pick up upstream changes; don't merge `main` into your branch.
- Before review, tidy your commits with an interactive rebase so each one is a meaningful, self-contained step.
- During review, push follow-up changes as `fixup!` commits (`git commit --fixup <sha>`) so reviewers can see what changed. Squash them (`git rebase -i --autosquash`) once the review is approved, before merging.
- Don't force-push over a branch someone else is working on without telling them.

## Pull request review

- Keep pull requests focused. Several small pull requests are easier to review than one large one.
- In the description, cover: what changed and why, how you tested it, screenshots for UI changes, and any effect on privacy, security, the database schema or the public API.
- Every pull request needs at least one approving review from a maintainer and passing checks before it's merged.
- Changes to cryptography, authentication, settlement, webhooks or address handling get extra scrutiny and may need a second reviewer.
- Reviewers: be specific, say whether a comment is blocking or a suggestion, and explain why. Authors: reply to every comment, either with a change or a reason.
- Mark pull requests that aren't ready as **Draft**.

## Merge workflow

- Maintainers merge approved pull requests into `main` using **rebase and merge**, or **squash and merge** for single-change pull requests, so `main` stays linear.
- `main` must always build, pass tests and be deployable.
- Changes to the public `/v1` API or webhook payloads must stay backwards compatible. Breaking changes need a new version and a migration note in the docs.
- Database migrations must be safe to run against a live database: add columns as nullable or with defaults, and backfill in a separate step.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
