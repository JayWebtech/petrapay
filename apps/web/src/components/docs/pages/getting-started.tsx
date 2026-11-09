import { Code2, Link2, Lock, Receipt, Store, Webhook } from "lucide-react";
import { API_V1 } from "@/lib/public-config";
import { A, C, Callout, Card, CardGroup, Code, H2, H3, List, P, Step, Steps, Table } from "../ui";

export function Introduction() {
  return (
    <>
      <P>
        PetraPay is a payment gateway for businesses, online stores and creators who want to be paid privately. Your customers pay with whatever they
        already hold (USDC, ETH, SOL, BTC and 190+ other tokens on many chains), and you receive <strong>shielded ZEC</strong> in the Orchard pool,
        where your balance and spending stay private.
      </P>
      <P>PetraPay is non-custodial: payments go from the customer straight to your own Zcash wallet. We never hold funds or keys.</P>

      <H2>Ways to get paid</H2>
      <CardGroup>
        <Card title="Invoices" href="/docs/invoices" icon={Receipt}>
          Bill a client for work with line items and a due date.
        </Card>
        <Card title="Payment links" href="/docs/payment-links" icon={Link2}>
          One reusable link for products, tips and donations.
        </Card>
        <Card title="Point of sale" href="/docs/point-of-sale" icon={Store}>
          In-person payments on an Android terminal, with printed receipts.
        </Card>
        <Card title="Developer API" href="/docs/api" icon={Code2}>
          Create checkouts from your own website or app.
        </Card>
      </CardGroup>

      <H2>Start here</H2>
      <CardGroup cols={3}>
        <Card title="Quickstart" href="/docs/quickstart">
          Your first paid checkout in five minutes.
        </Card>
        <Card title="How it works" href="/docs/concepts">
          Quotes, settlement and shielded addresses.
        </Card>
        <Card title="Webhooks" href="/docs/webhooks" icon={Webhook}>
          Fulfil orders the moment they&apos;re paid.
        </Card>
      </CardGroup>

      <Callout type="tip" title="Private by design">
        Every payment settles to a fresh shielded address from a pool you supply, so payments can&apos;t be linked to each other on-chain. See the{" "}
        <A href="/docs/privacy">privacy model</A> for exactly what is and isn&apos;t public.
      </Callout>
    </>
  );
}

export function Quickstart() {
  return (
    <>
      <P>You&apos;ll need a Zcash wallet that gives you unified addresses with an Orchard receiver, such as Zashi.</P>
      <Steps>
        <Step title="Create your account">
          <P>
            Open PetraPay and choose <strong>Create account</strong>. You&apos;ll get a 12-word recovery phrase: it <em>is</em> your account (there&apos;s
            no email or password), so write it down somewhere safe.
          </P>
        </Step>
        <Step title="Add shielded addresses">
          <P>
            In <strong>Shielded addresses</strong>, paste a few unified addresses from your wallet (they start with <C>u1</C>). In Zashi, tap Receive,
            copy, and repeat; each time it shows a new address. Every payment uses a fresh one from this pool.
          </P>
        </Step>
        <Step title="Create something to pay">
          <P>
            Pick whatever fits: an <A href="/docs/invoices">invoice</A>, a <A href="/docs/payment-links">payment link</A>, a sale on your{" "}
            <A href="/docs/point-of-sale">POS terminal</A>, or a checkout from <A href="/docs/api/checkouts">the API</A>.
          </P>
        </Step>
        <Step title="Share it and get paid">
          <P>
            Send the link or show the QR. Your customer picks a token, sees the exact amount with fees included, and pays from their wallet. A few
            minutes later the ZEC lands in your wallet, shielded.
          </P>
        </Step>
      </Steps>

      <H2>Integrating your website?</H2>
      <P>Create a secret key in Dashboard → Developers, then create a checkout from your server and redirect the customer to its URL:</P>
      <Code
        samples={[
          {
            label: "curl",
            code: `curl ${API_V1}/checkouts \\
  -H "Authorization: Bearer pp_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "currency": "USD", "amount": "25.00", "title": "Order #1001" }'`,
          },
        ]}
      />
      <P>
        Continue with the <A href="/docs/api">API overview</A>, or try everything without real money in <A href="/docs/testing">test mode</A>.
      </P>
    </>
  );
}

export function Concepts() {
  return (
    <>
      <H2>Checkouts</H2>
      <P>
        Everything a customer pays (an invoice, a payment-link purchase, a POS sale or an API checkout) is a <strong>checkout</strong>: an amount in USD
        or ZEC, a hosted payment page, and a status.
      </P>
      <Table
        head={["Status", "Meaning"]}
        rows={[
          ["open", "Waiting for payment."],
          ["processing", "The customer's payment arrived and is being converted to ZEC."],
          ["paid", "ZEC was delivered to your shielded address."],
          ["cancelled", "Cancelled by you."],
          ["expired", "Passed its expiry without being paid (API checkouts and POS sales)."],
        ]}
      />

      <H2>Shielded address pool</H2>
      <P>
        You give PetraPay a pool of unified addresses from your own wallet. Each checkout takes an unused one, so on-chain observers can&apos;t tell that
        two payments went to the same merchant. When the pool runs out, PetraPay reuses your default address and flags it in the dashboard, so keep it
        topped up.
      </P>
      <Callout type="note">Only addresses with an Orchard receiver are accepted. Transparent and Sapling-only addresses are rejected.</Callout>

      <H2>Quotes and settlement</H2>
      <P>
        When a customer picks a token, PetraPay requests a <strong>signed quote</strong> from a decentralized swap network: exactly how much of their
        token to send, fees included, so that you receive the exact ZEC amount of the checkout. PetraPay verifies the quote&apos;s signature and that it
        pays your address before showing a one-time deposit address.
      </P>
      <List ordered>
        <li>The customer sends their token to the one-time deposit address.</li>
        <li>Market makers swap it into ZEC.</li>
        <li>ZEC is delivered to your shielded address. The checkout becomes paid.</li>
      </List>
      <P>
        If anything goes wrong (the wrong amount, or a quote that expired), the customer is refunded automatically to the address they gave. Funds never
        sit with PetraPay.
      </P>

      <H3>USD or ZEC pricing</H3>
      <P>
        A <C>USD</C> checkout converts at the ZEC price when the customer requests their quote, so you receive ZEC worth that many dollars. A{" "}
        <C>ZEC</C> checkout delivers exactly that much ZEC.
      </P>

      <H2>Paying with shielded ZEC directly</H2>
      <P>
        Customers who already hold ZEC can pay straight to your shielded address with a ZIP-321 QR. Because shielded transfers are invisible without a
        viewing key, and PetraPay never asks for one, these payments can&apos;t be detected automatically: the customer taps &quot;I&apos;ve sent
        it&quot; and you mark the checkout paid after checking your wallet.
      </P>

      <H2>Your account</H2>
      <P>
        There&apos;s no email or password. Your account is a key derived from your 12-word recovery phrase and kept in your browser. Lose the phrase and
        nobody, including us, can recover the account. Your funds are always in your own wallet either way.
      </P>
      <Callout type="tip">
        <Lock className="mr-1 inline size-3.5" /> Private notes and payment-link form answers are encrypted in the browser, so the server only stores
        ciphertext.
      </Callout>
    </>
  );
}
