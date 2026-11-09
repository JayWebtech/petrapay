import { A, C, Callout, Code, H2, H3, List, P, Step, Steps, Table } from "../ui";

export function Privacy() {
  return (
    <>
      <P>
        PetraPay is built so that being paid doesn&apos;t expose your business. Here is exactly what stays private and what doesn&apos;t.
      </P>

      <H2>What stays private</H2>
      <List>
        <li>
          <strong>Your balance and spending.</strong> Payments land in the Orchard shielded pool. Nobody can see how much you hold or where you send it.
        </li>
        <li>
          <strong>Links between payments.</strong> Every checkout uses a fresh address from your pool, so two payments can&apos;t be tied to the same
          merchant on-chain.
        </li>
        <li>
          <strong>Your identity.</strong> No email, password or KYC. Your account is a key derived from your recovery phrase.
        </li>
        <li>
          <strong>Private data.</strong> Private notes and payment-link form answers are encrypted in the browser. The server only stores ciphertext.
        </li>
      </List>

      <H2>What is public</H2>
      <Table
        head={["Data", "Who can see it"]}
        rows={[
          ["Customer's payment", "The customer's transfer on their own chain is public, as it is with any payment from a transparent chain."],
          ["Deposit addresses", "Each quote uses a one-time deposit address. It isn't linked to your Zcash wallet."],
          ["Withdrawal amount", "The ZEC you send for a withdrawal is visible on-chain; where it came from stays shielded."],
          ["Invoice page", "Anyone with the link sees what's on it: title, items, amount and the optional client name."],
        ]}
      />

      <H2>What PetraPay knows</H2>
      <P>
        The server stores what it needs to run your checkouts: amounts, titles, statuses, the shielded address each one pays and your optional client
        names and emails. It never holds funds, never sees your wallet&apos;s keys and never asks for a viewing key.
      </P>
      <Callout type="tip">
        For the strongest privacy, keep your pool topped up so addresses are never reused, and pay out from your wallet within the shielded pool.
      </Callout>
    </>
  );
}

export function Fees() {
  return (
    <>
      <P>
        You receive the full amount of the checkout. The network costs of converting the customer&apos;s token into ZEC are built into the quote they
        see, so there are no surprises on either side.
      </P>

      <H2>What the customer pays</H2>
      <List>
        <li>The checkout amount, converted into their token at the live rate.</li>
        <li>Swap and network fees, included in the quote. The customer sees the exact total before paying.</li>
        <li>Their own wallet&apos;s gas fee for sending the token.</li>
      </List>

      <H2>What you receive</H2>
      <P>
        Exactly the checkout&apos;s ZEC amount (for a USD checkout, ZEC worth that many dollars at quote time), delivered to your shielded address.
      </P>

      <H3>Platform fee</H3>
      <P>
        An instance can charge a small platform fee, added to the customer&apos;s quote and shown in it. Self-hosted instances choose their own, or none.
      </P>

      <H2>Paying with ZEC directly</H2>
      <P>Customers paying shielded ZEC directly pay only the Zcash network fee, a fraction of a cent.</P>

      <H2>Withdrawals</H2>
      <P>A withdrawal&apos;s quote shows exactly what you&apos;ll receive after swap and network fees.</P>
    </>
  );
}

export function SelfHosting() {
  return (
    <>
      <P>
        PetraPay is open source. You can run your own instance: a Next.js web app and a Node.js API with PostgreSQL. A common setup is the web app on
        Vercel and the API on Railway.
      </P>

      <H2>Requirements</H2>
      <List>
        <li>Node.js 20.19+ and pnpm</li>
        <li>PostgreSQL 15+</li>
        <li>An API key for the swap network (see the API&apos;s example env file)</li>
      </List>

      <H2>Deploy the API</H2>
      <Steps>
        <Step title="Create the service">
          <P>
            On Railway, create a service from the repository and add a PostgreSQL database. The repository&apos;s <C>railway.json</C> sets the build
            and start commands and a <C>/health</C> check.
          </P>
        </Step>
        <Step title="Set environment variables">
          <P>
            Copy the variables from <C>apps/api/.env.example</C>. The important ones:
          </P>
          <Table
            head={["Variable", "Purpose"]}
            rows={[
              ["DATABASE_URL", "Your PostgreSQL connection string."],
              ["APP_ORIGIN", "Your web app's URL, e.g. https://pay.example.com. Used for CORS and checkout URLs."],
              ["COOKIE_SECURE", "true in production."],
              ["APP_FEE_BPS", "Optional platform fee in basis points (0–400). Needs APP_FEE_RECIPIENT."],
              ["WORKER_ENABLED", "Runs the background worker that tracks payments and delivers webhooks."],
            ]}
          />
        </Step>
        <Step title="Deploy">
          <P>
            The start command applies database migrations, then starts the server. Attach a custom domain such as <C>api.example.com</C>.
          </P>
        </Step>
      </Steps>

      <H2>Deploy the web app</H2>
      <Steps>
        <Step title="Import the project">
          <P>
            On Vercel, import the repository and set the root directory to <C>apps/web</C>. Its <C>vercel.json</C> installs only what the web app needs.
          </P>
        </Step>
        <Step title="Point it at your API">
          <Table
            head={["Variable", "Purpose"]}
            rows={[
              ["API_URL", "The API's URL. The web app proxies /api/* to it."],
              ["NEXT_PUBLIC_API_ORIGIN", "The public API origin shown in these docs and the dashboard, e.g. https://api.example.com."],
              ["NEXT_PUBLIC_SOLANA_RPC_URL", "A Solana RPC for the Pay with wallet button."],
            ]}
          />
        </Step>
      </Steps>

      <H2>Run locally</H2>
      <Code
        samples={[
          {
            label: "Terminal",
            code: `pnpm install
cp apps/api/.env.example apps/api/.env   # fill it in
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @petrapay/api exec prisma migrate deploy
pnpm dev`,
          },
        ]}
      />
      <Callout type="note">
        Point the POS app at your instance by building it with <C>-PPETRAPAY_API_URL=https://api.example.com</C>. See the POS app&apos;s README.
      </Callout>
    </>
  );
}

const FAQ: [string, React.ReactNode][] = [
  ["Do my customers need Zcash?", "No. They pay with whatever they hold, such as USDC, ETH, SOL or BTC, from any wallet or exchange. Only you receive ZEC."],
  ["Does PetraPay ever hold my money?", "No. Payments go from the customer, through the swap network, straight to your own Zcash wallet."],
  ["How long does a payment take?", "Usually a few minutes from when the customer sends their token, depending on their chain's confirmation time."],
  [
    "What if a customer sends the wrong amount?",
    "If the payment can't complete, it's refunded automatically to the refund address the customer gave. Nothing gets stuck with PetraPay.",
  ],
  ["Which Zcash wallets work?", "Any wallet that gives unified addresses with an Orchard receiver, such as Zashi."],
  [
    "I lost my recovery phrase. Can you restore my account?",
    "No. There's no email or password to reset. Your funds are safe in your own wallet, but you'll need a new account.",
  ],
  ["Can I accept payments on my website?", <>Yes. Use the <A href="/docs/api">API</A> to create checkouts and <A href="/docs/webhooks">webhooks</A> to fulfil orders.</>],
  ["Is there a test mode?", <>Yes, for POS terminals. See <A href="/docs/testing">Testing</A>.</>],
  ["Can I issue refunds?", "Send the customer ZEC or any token from your own wallet, or use a withdrawal to send a token to their address."],
];

export function Faq() {
  return (
    <div className="my-6 divide-y divide-border rounded-2xl border border-border">
      {FAQ.map(([q, a]) => (
        <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
            {q}
            <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-[15px] leading-7 text-foreground/80">{a}</p>
        </details>
      ))}
    </div>
  );
}
