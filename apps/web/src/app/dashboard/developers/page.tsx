"use client";

import type { ApiKeyDTO, CreatedApiKeyDTO, WebhookEndpointDetailDTO, WebhookEndpointDTO } from "@petrapay/shared";
import { AlertTriangle, BookOpen, ChevronRight, KeyRound, Plus, Webhook } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader, Panel, Pill } from "@/components/app/dash/ui";
import { CodeBlock } from "@/components/app/developers/code-block";
import { EventPicker } from "@/components/app/developers/event-picker";
import { summarizeEvents, useApiBase } from "@/components/app/developers/meta";
import { TextField } from "@/components/app/field";
import { formatDate } from "@/components/app/invoice-row";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const when = (iso: string | null) => (iso ? formatDate(iso, { month: "short", day: "numeric", year: "numeric" }) : "Never");

export default function DevelopersPage() {
  const base = useApiBase();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developers"
        description="Accept shielded payments on your own site: create a checkout from your server, send the customer to it, and get a webhook when it's paid."
        actions={
          <Link href="/docs" target="_blank" className="btn-soft h-10 rounded-xl px-4 text-sm font-medium">
            <BookOpen className="size-4" /> API docs
          </Link>
        }
      />
      <ApiKeys />
      <Webhooks />
      <Panel title="Quick start">
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium">1. Create a checkout on your server</p>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">Then redirect the customer to the returned `url`.</p>
            <CodeBlock
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
    amount: order.total, // "49.99"
    title: \`Order #\${order.number}\`,
    reference: order.id,
    success_url: "https://shop.example/thanks?checkout={CHECKOUT_ID}",
  }),
});
const checkout = await res.json();
redirect(checkout.url);`,
                },
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-medium">2. Fulfil the order on `checkout.paid`</p>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">Verify the signature with your endpoint&apos;s signing secret.</p>
            <CodeBlock
              samples={[
                {
                  label: "Node.js",
                  code: `import crypto from "node:crypto";

// Use the raw request body, before JSON parsing.
function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/webhooks/petrapay", express.raw({ type: "application/json" }), (req, res) => {
  if (!verify(req.body.toString(), req.get("PetraPay-Signature"), process.env.PETRAPAY_WEBHOOK_SECRET)) {
    return res.status(400).end();
  }
  const event = JSON.parse(req.body);
  if (event.type === "checkout.paid") fulfil(event.data.object.reference);
  res.sendStatus(200);
});`,
                },
              ]}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ApiKeys() {
  const toast = useToast();
  const { data: keys, error, setData } = useApi<ApiKeyDTO[]>("/api-keys");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<CreatedApiKeyDTO | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await api<CreatedApiKeyDTO>("/api-keys", { body: { name: name.trim() } });
      setFresh(created);
      setData([created.key, ...(keys ?? [])]);
      setName("");
    } catch (err) {
      toast.error("Couldn't create key", errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (key: ApiKeyDTO) => {
    try {
      const revoked = await api<ApiKeyDTO>(`/api-keys/${key.id}`, { method: "DELETE" });
      setData((keys ?? []).map((k) => (k.id === key.id ? revoked : k)));
      toast.success("Key revoked", `Requests using ${revoked.preview} now fail.`);
    } catch (err) {
      toast.error("Couldn't revoke key", errorMessage(err));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <Panel title="Secret API keys" action={<span className="hidden text-xs text-muted-foreground sm:block">Use from your server only, never in a browser or app</span>}>
      {fresh ? (
        <div className="border-b border-border bg-[#f6f5fe] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" /> {fresh.key.name}: copy your key now
          </p>
          <p className="mt-1 text-xs text-muted-foreground">For your security it won&apos;t be shown again. Store it in your server&apos;s environment, e.g. PETRAPAY_SECRET_KEY.</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-white py-1.5 pr-1.5 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{fresh.secret}</code>
            <CopyButton value={fresh.secret} label="Copy secret key" showLabel className="text-foreground" />
          </div>
          <button type="button" onClick={() => setFresh(null)} className="btn-soft mt-3 h-9 rounded-xl px-3.5 text-sm font-medium">
            I&apos;ve saved it
          </button>
        </div>
      ) : null}

      <form onSubmit={create} className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start">
        <div className="flex-1">
          <TextField aria-label="Key name" placeholder="Name, e.g. Production store" value={name} onChange={setName} maxLength={60} />
        </div>
        <button type="submit" disabled={creating || !name.trim()} className="btn-solid h-12 rounded-2xl px-5 text-sm font-semibold">
          {creating ? <Loader variant="spinner" size={14} /> : <Plus className="size-4" />} Create secret key
        </button>
      </form>

      {error && !keys ? (
        <p className="px-5 py-8 text-center text-sm text-destructive">{error}</p>
      ) : !keys ? (
        <div className="grid h-24 place-items-center text-muted-foreground">
          <Loader variant="dots" size={20} />
        </div>
      ) : keys.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No keys yet. Create one to start using the API.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 pr-3 pl-5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Key</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium">Last used</th>
                <th className="py-2.5 pr-5 pl-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => (
                <tr key={k.id} className={cn(k.revokedAt && "text-muted-foreground")}>
                  <td className="py-3 pr-3 pl-5 font-medium">{k.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{k.preview}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{when(k.createdAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{when(k.lastUsedAt)}</td>
                  <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
                    {k.revokedAt ? (
                      <Pill tone="neutral">Revoked</Pill>
                    ) : confirming === k.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => revoke(k)} className="h-8 rounded-lg bg-[#fdecec] px-2.5 text-xs font-semibold text-destructive">
                          Revoke now
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(k.id)}
                        className="h-8 rounded-lg px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-[#fdecec]"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Webhooks() {
  const router = useRouter();
  const toast = useToast();
  const { data: endpoints, error } = useApi<WebhookEndpointDTO[]>("/webhooks");
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["checkout.paid"]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (events.length === 0) return setFormError("Pick at least one event");
    setSaving(true);
    setFormError(null);
    try {
      const created = await api<WebhookEndpointDetailDTO>("/webhooks", { body: { url: url.trim(), events } });
      toast.success("Endpoint added", "Copy its signing secret to verify events.");
      router.push(`/dashboard/developers/webhooks/${created.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Webhooks"
      action={
        !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn-soft h-8 rounded-lg px-3 text-xs font-medium">
            <Plus className="size-3.5" /> Add endpoint
          </button>
        ) : null
      }
    >
      {adding ? (
        <form onSubmit={create} className="space-y-4 border-b border-border p-5">
          <TextField label="Endpoint URL" placeholder="https://shop.example/webhooks/petrapay" value={url} onChange={setUrl} mono type="url" error={formError ?? undefined} />
          <div>
            <p className="mb-2 text-sm font-medium">Events to send</p>
            <EventPicker value={events} onChange={setEvents} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !url.trim()} className="btn-solid h-11 rounded-xl px-4 text-sm font-semibold">
              {saving ? <Loader variant="spinner" size={14} /> : null} Add endpoint
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-11 rounded-xl px-4 text-sm text-muted-foreground hover:bg-muted">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error && !endpoints ? (
        <p className="px-5 py-8 text-center text-sm text-destructive">{error}</p>
      ) : !endpoints ? (
        <div className="grid h-24 place-items-center text-muted-foreground">
          <Loader variant="dots" size={20} />
        </div>
      ) : endpoints.length === 0 && !adding ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <span className="icon-tile size-11">
            <Webhook className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-semibold">No endpoints yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Get a signed POST to your server when a checkout is paid, so orders fulfil automatically.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {endpoints.map((ep) => (
            <li key={ep.id}>
              <Link href={`/dashboard/developers/webhooks/${ep.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#fafafe]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]">{ep.url}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {summarizeEvents(ep.events)} · {ep.recent.total} sent in 7 days
                  </p>
                </div>
                {ep.recent.failed > 0 ? (
                  <Pill tone="danger" icon={<AlertTriangle className="size-3" strokeWidth={2.5} />}>
                    {ep.recent.failed} failed
                  </Pill>
                ) : null}
                {ep.active ? <Pill tone="success">Enabled</Pill> : <Pill tone="neutral">Disabled</Pill>}
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
