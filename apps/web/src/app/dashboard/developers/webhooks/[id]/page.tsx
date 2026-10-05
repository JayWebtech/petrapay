"use client";

import type { WebhookDeliveryDTO, WebhookEndpointDetailDTO } from "@petrapay/shared";
import { ArrowLeft, ChevronDown, Eye, EyeOff, RotateCw, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { CopyButton } from "@/components/app/copy-button";
import { Panel, Pill } from "@/components/app/dash/ui";
import { EventPicker } from "@/components/app/developers/event-picker";
import { summarizeEvents } from "@/components/app/developers/meta";
import { formatDate } from "@/components/app/invoice-row";
import { useToast } from "@/components/app/toaster";
import { Loader } from "@/components/motion/loader";
import { Switch } from "@/components/motion/switch";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const when = (iso: string) => formatDate(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

function DeliveryPill({ d }: { d: WebhookDeliveryDTO }) {
  if (d.status === "SUCCEEDED") return <Pill tone="success">Delivered</Pill>;
  if (d.status === "FAILED") return <Pill tone="danger">Failed</Pill>;
  return d.attempts > 0 ? <Pill tone="warning">Retrying</Pill> : <Pill tone="info">Queued</Pill>;
}

export default function WebhookEndpointPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: endpoint, error, setData } = useApi<WebhookEndpointDetailDTO>(`/webhooks/${id}`);
  const deliveries = useApi<WebhookDeliveryDTO[]>(`/webhooks/${id}/deliveries`, { pollMs: 5000 });
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [events, setEvents] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  if (error && !endpoint) return <p className="text-sm text-destructive">{error}</p>;
  if (!endpoint) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader variant="dots" size={24} />
      </div>
    );
  }

  const run = async <T,>(key: string, fn: () => Promise<T>, done?: (result: T) => void) => {
    setBusy(key);
    try {
      done?.(await fn());
    } catch (err) {
      toast.error("Something went wrong", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const update = (body: Record<string, unknown>, message: string) =>
    run("update", () => api<WebhookEndpointDetailDTO>(`/webhooks/${id}`, { method: "PATCH", body }), (next) => {
      setData(next);
      setEvents(null);
      toast.success(message);
    });

  const sendTest = () =>
    run("test", () => api<WebhookDeliveryDTO>(`/webhooks/${id}/test`, { method: "POST" }), (d) => {
      void deliveries.reload();
      setOpen(d.id);
      if (d.status === "SUCCEEDED") toast.success("Test event delivered", `Your endpoint answered ${d.responseStatus}.`);
      else toast.error("Test event failed", d.responseStatus ? `Your endpoint answered ${d.responseStatus}.` : (d.responseBody ?? "No response"));
    });

  const retry = (d: WebhookDeliveryDTO) =>
    run(`retry-${d.id}`, () => api<WebhookDeliveryDTO>(`/webhooks/${id}/deliveries/${d.id}/retry`, { method: "POST" }), (next) => {
      void deliveries.reload();
      if (next.status === "SUCCEEDED") toast.success("Delivered");
      else toast.error("Still failing", next.responseStatus ? `HTTP ${next.responseStatus}` : (next.responseBody ?? ""));
    });

  const remove = () =>
    run("delete", () => api(`/webhooks/${id}`, { method: "DELETE" }), () => {
      toast.success("Endpoint deleted");
      router.push("/dashboard/developers");
    });

  const rotate = () =>
    run("rotate", () => api<WebhookEndpointDetailDTO>(`/webhooks/${id}/rotate-secret`, { method: "POST" }), (next) => {
      setData(next);
      setRevealed(true);
      setConfirmRotate(false);
      toast.success("New signing secret", "Update it on your server; the old one stops working now.");
    });

  const editing = events !== null;
  const list = deliveries.data;

  return (
    <div className="space-y-8">
      <Link href="/dashboard/developers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Developers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Webhook endpoint · added {formatDate(endpoint.createdAt, { month: "short", day: "numeric", year: "numeric" })}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 font-mono text-lg font-semibold break-all sm:text-xl">{endpoint.url}</h1>
            {endpoint.active ? <Pill tone="success">Enabled</Pill> : <Pill tone="neutral">Disabled</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={sendTest} disabled={busy !== null || !endpoint.active} className="btn-soft h-9 rounded-xl px-3 text-sm font-medium">
            {busy === "test" ? <Loader variant="spinner" size={14} /> : <Send className="size-3.5" />} Send test event
          </button>
          {confirmDelete ? (
            <>
              <button type="button" onClick={remove} disabled={busy !== null} className="h-9 rounded-xl bg-[#fdecec] px-3 text-sm font-semibold text-destructive">
                Delete endpoint
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted">
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-9 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-[#fdecec]"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Recent deliveries" action={<span className="text-xs text-muted-foreground">Retried with backoff for about 2 days</span>}>
          {!list ? (
            <div className="grid h-32 place-items-center text-muted-foreground">
              <Loader variant="dots" size={20} />
            </div>
          ) : list.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">No deliveries yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Send a test event to check your endpoint is reachable.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pr-3 pl-5 font-medium">Event</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Response</th>
                    <th className="px-3 py-2.5 font-medium">Created</th>
                    <th className="w-10 py-2.5 pr-5 pl-3">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const expanded = open === d.id;
                    return (
                      <Fragment key={d.id}>
                        <tr
                          onClick={() => setOpen(expanded ? null : d.id)}
                          className={cn("cursor-pointer border-b border-border transition-colors hover:bg-[#fafafe]", expanded && "bg-[#fafafe]")}
                        >
                          <td className="py-3 pr-3 pl-5 font-mono text-[13px]">{d.eventType}</td>
                          <td className="px-3 py-3">
                            <DeliveryPill d={d} />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular">
                            {d.responseStatus ? `HTTP ${d.responseStatus}` : d.attempts > 0 ? "No response" : "—"}
                            {d.attempts > 1 ? <span className="ml-1 text-xs">· {d.attempts} tries</span> : null}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{when(d.createdAt)}</td>
                          <td className="py-3 pr-5 pl-3 text-right">
                            <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-border bg-[#fafafe]">
                            <td colSpan={5} className="px-5 pt-1 pb-5">
                              <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-muted-foreground">
                                <span className="font-mono">{d.eventId}</span>
                                <span>
                                  {d.nextAttemptAt ? `Next try ${when(d.nextAttemptAt)} · ` : ""}
                                  {d.lastAttemptAt ? `Last tried ${when(d.lastAttemptAt)}` : "Not tried yet"}
                                </span>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="min-w-0">
                                  <p className="mb-1.5 text-xs font-medium">Request body</p>
                                  <pre className="max-h-72 overflow-auto rounded-xl bg-[#0b0a24] p-3 font-mono text-[11.5px] leading-relaxed text-[#e7e5ff]">
                                    {JSON.stringify(d.payload, null, 2)}
                                  </pre>
                                </div>
                                <div className="min-w-0">
                                  <p className="mb-1.5 text-xs font-medium">Response</p>
                                  <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-white p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                                    {d.responseBody || "(empty)"}
                                  </pre>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => retry(d)}
                                disabled={busy !== null || !endpoint.active}
                                className="btn-soft mt-3 h-9 rounded-xl px-3 text-sm font-medium"
                              >
                                {busy === `retry-${d.id}` ? <Loader variant="spinner" size={14} /> : <RotateCw className="size-3.5" />}
                                {d.status === "SUCCEEDED" ? "Resend" : "Retry now"}
                              </button>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="space-y-6">
          <Panel title="Signing secret">
            <div className="p-5">
              <div className="flex items-center gap-2 rounded-xl border border-border py-1.5 pr-1.5 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{revealed ? endpoint.secret : `whsec_${"•".repeat(24)}`}</code>
                <button
                  type="button"
                  onClick={() => setRevealed((r) => !r)}
                  aria-label={revealed ? "Hide secret" : "Reveal secret"}
                  className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <CopyButton value={endpoint.secret} label="Copy signing secret" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Every request carries a <code className="font-mono">PetraPay-Signature</code> header: an HMAC-SHA256 of the timestamp and body with this secret.
              </p>
              {confirmRotate ? (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={rotate} disabled={busy !== null} className="h-8 rounded-lg bg-[#fdecec] px-2.5 text-xs font-semibold text-destructive">
                    Rotate now
                  </button>
                  <button type="button" onClick={() => setConfirmRotate(false)} className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmRotate(true)} className="mt-3 text-xs font-medium text-primary hover:underline">
                  Rotate secret
                </button>
              )}
            </div>
          </Panel>

          <Panel
            title="Settings"
            action={
              <Switch
                checked={endpoint.active}
                onCheckedChange={(active) => void update({ active }, active ? "Endpoint enabled" : "Endpoint disabled")}
                label={endpoint.active ? "Enabled" : "Disabled"}
                className="text-xs"
              />
            }
          >
            <div className="p-5">
              <p className="text-xs text-muted-foreground">Listening for</p>
              {editing ? (
                <div className="mt-3">
                  <EventPicker value={events} onChange={setEvents} />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={busy !== null || events.length === 0}
                      onClick={() => void update({ events }, "Events updated")}
                      className="btn-solid h-9 rounded-xl px-3.5 text-sm font-semibold"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEvents(null)} className="h-9 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm font-medium">{summarizeEvents(endpoint.events)}</p>
                  {!endpoint.events.includes("*") ? (
                    <ul className="mt-2 space-y-1">
                      {endpoint.events.map((e) => (
                        <li key={e} className="font-mono text-xs text-muted-foreground">
                          {e}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button type="button" onClick={() => setEvents(endpoint.events)} className="mt-3 text-xs font-medium text-primary hover:underline">
                    Change events
                  </button>
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
