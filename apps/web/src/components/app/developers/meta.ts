import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@petrapay/shared";
import { useSyncExternalStore } from "react";

export const EVENT_INFO: Record<WebhookEventType, string> = {
  "checkout.created": "A checkout was created: from your dashboard, the API, or a payment link.",
  "checkout.processing": "The customer's payment arrived and is being converted to ZEC.",
  "checkout.paid": "The payment settled to your shielded address. Fulfil the order.",
  "checkout.cancelled": "The checkout was cancelled.",
  "checkout.expired": "The checkout expired before it was paid.",
};

export { WEBHOOK_EVENT_TYPES };

const noop = () => () => { };

/** This deployment's public API base, e.g. https://pay.example.com/api/v1. */
export function useApiBase(): string {

  return `https://petrapay-production.up.railway.app/api/v1`;
}

export function summarizeEvents(events: string[]): string {
  if (events.includes("*")) return "All events";
  return events.length === 1 ? events[0]! : `${events.length} events`;
}
