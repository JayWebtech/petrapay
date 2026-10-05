"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { CodeBlock } from "@/components/app/developers/code-block";
import { EVENT_INFO, WEBHOOK_EVENT_TYPES, useApiBase } from "@/components/app/developers/meta";
import { LogoMark } from "@/components/app/logo";

const SECTIONS = [
  ["overview", "Overview"],
  ["authentication", "Authentication"],
  ["errors", "Errors"],
  ["idempotency", "Idempotency"],
  ["pagination", "Pagination"],
  ["checkouts", "Checkouts"],
  ["checkout-flow", "Hosted checkout flow"],
  ["payment-links", "Payment links"],
  ["webhooks", "Webhooks"],
  ["signatures", "Verifying signatures"],
] as const;

const CHECKOUT_EXAMPLE = `{
  "id": "G8VN5idaQDX6",
  "object": "checkout",
  "url": "https://pay.example.com/pay/G8VN5idaQDX6",
  "status": "open",
  "number": 42,
  "currency": "USD",
  "amount": "49.99",
  "title": "Order #1001",
  "description": null,
  "line_items": [{ "description": "Order #1001", "quantity": 1, "unit_amount": "49.99" }],
  "reference": "order_1001",
  "metadata": { "cart_id": "c_93" },
  "customer": { "name": null, "email": "buyer@example.com" },
  "success_url": "https://shop.example/thanks?checkout={CHECKOUT_ID}",
  "cancel_url": "https://shop.example/cart",
  "payment_link": null,
  "source": "api",
  "amount_received": null,
  "expires_at": "2026-10-06T09:00:00.000Z",
  "paid_at": null,
  "created_at": "2026-10-05T09:00:00.000Z"
}`;

export function DocsContent() {
  const base = useApiBase();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="size-6" /> PetraPay <span className="font-normal text-muted-foreground">API</span>
          </Link>
          <Link href="/dashboard/developers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-14 pb-24">
          <Section id="overview" title="Accept shielded payments from your own site">
            <P>
              Create a checkout from your server, redirect the customer to its hosted payment page, and get a signed webhook when it&apos;s paid. Customers
              pay with 190+ tokens on any chain, or with shielded ZEC directly. You receive shielded ZEC at a fresh address from your pool, and PetraPay never
              holds your funds.
            </P>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-[#fafafe] py-2 pr-2 pl-4">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Base URL</span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm">{base}</code>
              <CopyButton value={base} label="Copy base URL" showLabel />
            </div>
            <P className="mt-4">Requests and responses are JSON. Amounts are decimal strings in the checkout&apos;s currency: USD or ZEC.</P>
          </Section>

          <Section id="authentication" title="Authentication">
            <P>
              Create a secret key under <strong>Dashboard → Developers</strong> and send it as a bearer token. Keys start with <Code>pp_sk_</Code> and are
              shown once. Keep them on your server: never put them in a browser, a mobile app or a public repo. Revoke a key from the dashboard if it leaks.
            </P>
            <CodeBlock className="mt-4" samples={[{ label: "curl", code: `curl ${base}/checkouts \\\n  -H "Authorization: Bearer pp_sk_..."` }]} />
          </Section>

          <Section id="errors" title="Errors">
            <P>Failed requests return a 4xx or 5xx status with an error object. `param` names the offending field when there is one.</P>
            <CodeBlock
              className="mt-4"
              samples={[{ label: "400", code: `{\n  "error": {\n    "type": "invalid_request_error",\n    "message": "success_url: Must be a full http(s) URL",\n    "param": "success_url"\n  }\n}` }]}
            />
            <Table
              className="mt-4"
              head={["Type", "When"]}
              rows={[
                ["invalid_request_error", "Bad parameters (400), an unknown id (404), or an action not allowed in the current state (409)."],
                ["authentication_error", "Missing, invalid or revoked API key (401)."],
                ["idempotency_error", "An Idempotency-Key reused with different parameters, or still in progress."],
                ["rate_limit_error", "More than 120 requests a minute with one key (429)."],
                ["api_error", "Something went wrong on our side (5xx). Safe to retry with the same Idempotency-Key."],
              ]}
            />
          </Section>

          <Section id="idempotency" title="Idempotency">
            <P>
              Send an <Code>Idempotency-Key</Code> header on POST requests (your order id works well). Retrying with the same key and body within 24 hours
              returns the original response, with <Code>Idempotent-Replayed: true</Code>, instead of creating a second checkout. A request that fails
              doesn&apos;t use up its key.
            </P>
          </Section>

          <Section id="pagination" title="Pagination">
            <P>
              List endpoints return <Code>{`{ "object": "list", "data": [...], "has_more": true }`}</Code>, newest first. Pass <Code>limit</Code> (1–100,
              default 10) and <Code>starting_after</Code> with the last id you received to fetch the next page.
            </P>
          </Section>

          <Section id="checkouts" title="Checkouts">
            <P>A checkout is a single payment with a hosted page. Invoices and payment-link payments from your dashboard are checkouts too.</P>

            <Endpoint method="POST" path="/checkouts" summary="Create a checkout" />
            <Table
              head={["Parameter", "Description"]}
              rows={[
                ["currency  required", "USD or ZEC. USD checkouts are paid at the ZEC price when the customer pays; ZEC checkouts deliver exactly that much ZEC."],
                ["amount", "Total as a decimal string, e.g. \"49.99\". Minimum $1.00 or 0.001 ZEC. Give this or line_items."],
                ["line_items", "Up to 50 of { description, quantity (default 1), unit_amount }. The total is computed for you."],
                ["title  required", "Shown to the customer, up to 120 characters."],
                ["description", "Longer note shown on the checkout."],
                ["reference", "Your own id, e.g. an order id. Filterable, and included in webhooks."],
                ["metadata", "Up to 20 string key/value pairs, returned as-is."],
                ["customer", "{ name, email }, shown on the checkout as \"Billed to\"."],
                ["success_url", "Where to send the customer after paying. {CHECKOUT_ID} is replaced with the checkout id."],
                ["cancel_url", "Shown as a \"Back to …\" link before paying."],
                ["expires_in", "Seconds until the checkout stops accepting payments: 300 to 604800. Default 86400 (24 hours)."],
              ]}
            />
            <CodeBlock
              className="mt-4"
              samples={[
                {
                  label: "curl",
                  code: `curl ${base}/checkouts \\
  -H "Authorization: Bearer pp_sk_..." \\
  -H "Idempotency-Key: order_1001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "currency": "USD",
    "amount": "49.99",
    "title": "Order #1001",
    "reference": "order_1001",
    "customer": { "email": "buyer@example.com" },
    "success_url": "https://shop.example/thanks?checkout={CHECKOUT_ID}",
    "cancel_url": "https://shop.example/cart"
  }'`,
                },
                {
                  label: "Node.js",
                  code: `const res = await fetch("${base}/checkouts", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.PETRAPAY_SECRET_KEY}\`,
    "Idempotency-Key": order.id,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "USD",
    line_items: order.items.map((i) => ({ description: i.name, quantity: i.qty, unit_amount: i.price })),
    title: \`Order #\${order.number}\`,
    reference: order.id,
    success_url: "https://shop.example/thanks?checkout={CHECKOUT_ID}",
  }),
});
if (!res.ok) throw new Error((await res.json()).error.message);
const checkout = await res.json();
// Send the customer to checkout.url`,
                },
                {
                  label: "Python",
                  code: `import os, requests

checkout = requests.post(
    "${base}/checkouts",
    headers={
        "Authorization": f"Bearer {os.environ['PETRAPAY_SECRET_KEY']}",
        "Idempotency-Key": order_id,
    },
    json={
        "currency": "USD",
        "amount": "49.99",
        "title": "Order #1001",
        "reference": order_id,
        "success_url": "https://shop.example/thanks?checkout={CHECKOUT_ID}",
    },
).json()
# redirect(checkout["url"])`,
                },
              ]}
            />
            <p className="mt-6 mb-2 text-sm font-medium">The checkout object</p>
            <CodeBlock samples={[{ label: "JSON", code: CHECKOUT_EXAMPLE }]} />
            <Table
              className="mt-4"
              head={["status", "Meaning"]}
              rows={[
                ["open", "Waiting for the customer to pay."],
                ["processing", "The customer's payment arrived and is being converted to ZEC."],
                ["paid", "Settled to your shielded address; amount_received is set."],
                ["cancelled", "Cancelled by you."],
                ["expired", "Passed expires_at without being paid."],
              ]}
            />

            <Endpoint method="GET" path="/checkouts/:id" summary="Retrieve a checkout" />
            <Endpoint method="GET" path="/checkouts" summary="List checkouts" note="Filters: status, reference. Paginated." />
            <Endpoint method="POST" path="/checkouts/:id/cancel" summary="Cancel a checkout" note="Fails with 409 once a payment is underway or done." />
          </Section>

          <Section id="checkout-flow" title="Hosted checkout flow">
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/80">
              <li>Your server creates a checkout and redirects the customer to its <Code>url</Code>.</li>
              <li>The customer picks a token, sees an exact quote, and pays from their wallet. They can also pay shielded ZEC directly.</li>
              <li>When the payment settles, the page offers &quot;Continue to …&quot; and sends them to your <Code>success_url</Code> after a few seconds.</li>
              <li>
                Your webhook receives <Code>checkout.paid</Code>. Fulfil the order there, not on the success page: customers can close the tab before
                they&apos;re redirected.
              </li>
            </ol>
            <P className="mt-4">
              Good to know: a payment that was already underway can still settle after a checkout expires or is cancelled. You&apos;ll get{" "}
              <Code>checkout.paid</Code> either way. Direct shielded ZEC payments can&apos;t be detected automatically; when you mark one paid in the
              dashboard, <Code>checkout.paid</Code> fires then.
            </P>
          </Section>

          <Section id="payment-links" title="Payment links">
            <P>
              Reusable links for products, donations or tips. Each payment through a link becomes its own checkout, with <Code>payment_link</Code> set to the
              link&apos;s id. Custom form fields are set up in the dashboard, because answers are encrypted to a key that only exists in your browser.
            </P>
            <Endpoint method="POST" path="/payment_links" summary="Create a payment link" />
            <Table
              head={["Parameter", "Description"]}
              rows={[
                ["title  required", "What the customer is paying for."],
                ["currency  required", "USD or ZEC."],
                ["amount_type  required", "fixed (everyone pays amount) or custom (the customer chooses)."],
                ["amount", "Required for fixed links."],
                ["min_amount, max_amount", "Optional bounds for custom links."],
                ["presets", "Up to 4 suggested amounts for custom links."],
                ["description", "Shown on the link's page."],
              ]}
            />
            <Endpoint method="GET" path="/payment_links/:id" summary="Retrieve a payment link" />
            <Endpoint method="GET" path="/payment_links" summary="List payment links" note="Paginated." />
            <Endpoint method="POST" path="/payment_links/:id" summary="Update a payment link" note={`{ "active": false } pauses it.`} />
          </Section>

          <Section id="webhooks" title="Webhooks">
            <P>
              Add an endpoint under <strong>Dashboard → Developers</strong> and choose its events. Each event is POSTed as JSON. Reply with any 2xx within 10
              seconds; anything else is retried after 1 minute, 5 minutes, 30 minutes, 2, 5, 10 and 24 hours. Every attempt is shown in the dashboard,
              where you can also resend one or send a test <Code>ping</Code>.
            </P>
            <Table className="mt-4" head={["Event", "Sent when"]} rows={WEBHOOK_EVENT_TYPES.map((t) => [t, EVENT_INFO[t]])} />
            <CodeBlock
              className="mt-4"
              samples={[
                {
                  label: "Event",
                  code: `POST /your/webhook
PetraPay-Signature: t=1791190800,v1=5f2b…
PetraPay-Event-Id: evt_7Hq2cPx1…
PetraPay-Event-Type: checkout.paid

{
  "id": "evt_7Hq2cPx1…",
  "object": "event",
  "type": "checkout.paid",
  "created": 1791190800,
  "data": { "object": { "object": "checkout", "id": "G8VN5idaQDX6", "status": "paid", "reference": "order_1001", … } }
}`,
                },
              ]}
            />
            <P className="mt-4">
              Events can arrive more than once or out of order. Use the event <Code>id</Code> to skip duplicates, and fetch the checkout if you need its
              latest state.
            </P>
          </Section>

          <Section id="signatures" title="Verifying signatures">
            <P>
              The <Code>PetraPay-Signature</Code> header has a timestamp <Code>t</Code> and <Code>v1</Code>, the hex HMAC-SHA256 of{" "}
              <Code>{"`${t}.${rawBody}`"}</Code> keyed with your endpoint&apos;s signing secret (<Code>whsec_…</Code>). Compute it over the raw body, compare
              in constant time, and reject timestamps older than five minutes.
            </P>
            <CodeBlock
              className="mt-4"
              samples={[
                {
                  label: "Node.js",
                  code: `import crypto from "node:crypto";

export function verifyPetraPay(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && a.length === b.length && crypto.timingSafeEqual(a, b);
}`,
                },
                {
                  label: "Python",
                  code: `import hashlib, hmac, time

def verify_petrapay(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    signed = f"{parts['t']}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    fresh = abs(time.time() - int(parts["t"])) < 300
    return fresh and hmac.compare_digest(expected, parts.get("v1", ""))`,
                },
                {
                  label: "PHP",
                  code: `function verify_petrapay(string $rawBody, string $header, string $secret): bool {
    parse_str(str_replace(',', '&', $header), $parts);
    $expected = hash_hmac('sha256', $parts['t'] . '.' . $rawBody, $secret);
    $fresh = abs(time() - (int) $parts['t']) < 300;
    return $fresh && hash_equals($expected, $parts['v1'] ?? '');
}`,
                },
              ]}
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`text-[15px] leading-relaxed text-foreground/80 ${className ?? ""}`}>{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

function Endpoint({ method, path, summary, note }: { method: "GET" | "POST"; path: string; summary: string; note?: string }) {
  return (
    <div className="mt-6 mb-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${method === "GET" ? "bg-[#e7f6ec] text-[#0e6b35]" : "bg-[#eeecfd] text-primary"}`}>
          {method}
        </span>
        <code className="font-mono text-sm font-medium">{path}</code>
        <span className="text-sm text-muted-foreground">· {summary}</span>
      </p>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Table({ head, rows, className }: { head: [string, string]; rows: string[][]; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border ${className ?? ""}`}>
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-[#fafafe] text-left text-xs text-muted-foreground">
            <th className="w-[220px] px-4 py-2.5 font-medium">{head[0]}</th>
            <th className="px-4 py-2.5 font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([name, desc]) => {
            const [field, flag] = name!.split("  ");
            return (
              <tr key={name}>
                <td className="px-4 py-2.5 align-top">
                  <code className="font-mono text-[13px]">{field}</code>
                  {flag ? <span className="ml-1.5 text-[11px] text-destructive">{flag}</span> : null}
                </td>
                <td className="px-4 py-2.5 leading-relaxed text-foreground/80">{desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
