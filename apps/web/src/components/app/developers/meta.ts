import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@petrapay/shared";
import { API_V1 } from "@/lib/public-config";

export const EVENT_INFO: Record<WebhookEventType, string> = {
  "checkout.created": "A checkout was created: from your dashboard, the API, or a payment link.",
  "checkout.processing": "The customer's payment arrived and is being converted to ZEC.",
  "checkout.paid": "The payment settled to your shielded address. Fulfil the order.",
  "checkout.cancelled": "The checkout was cancelled.",
  "checkout.expired": "The checkout expired before it was paid.",
};

export { WEBHOOK_EVENT_TYPES };

/** The public API base, e.g. https://api.petrapay.xyz/v1 (set NEXT_PUBLIC_API_ORIGIN to change it). */
export function useApiBase(): string {
  return API_V1;
}

export function summarizeEvents(events: string[]): string {
  if (events.includes("*")) return "All events";
  return events.length === 1 ? events[0]! : `${events.length} events`;
}
