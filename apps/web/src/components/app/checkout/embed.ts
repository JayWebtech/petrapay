/**
 * Messages for sites that open the checkout in a popup with the `petrapay` npm package.
 * They carry only public checkout details (id, status, amount), so any opener may receive them.
 * Sites must still confirm a payment server-side (webhook or API) before fulfilling an order.
 */

export type EmbedEvent = "payment.created" | "payment.processing" | "payment.paid";

export type EmbedPayload = {
  checkoutId: string;
  linkId?: string | null;
  status: string;
  amount: string;
  currency: "USD" | "ZEC";
};

const sent = new Set<string>();

export function notifyOpener(type: EmbedEvent, payload: EmbedPayload) {
  if (typeof window === "undefined") return;
  const opener = window.opener as Window | null;
  if (!opener || opener === window) return;
  // Each event is sent once per checkout, however often the page re-renders.
  const key = `${type}:${payload.checkoutId}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    opener.postMessage({ source: "petrapay", version: 1, type, data: payload }, "*");
  } catch {
    // The opener navigated away or was closed.
  }
}

/** True when this page was opened by another site, e.g. via the npm package's popup. */
export function hasOpener(): boolean {
  return typeof window !== "undefined" && !!window.opener && window.opener !== window;
}
