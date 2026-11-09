/**
 * PetraPay checkout for any website: open a payment link or checkout in a popup and hear back
 * when the customer has paid. No API key is needed in the browser.
 */

export const DEFAULT_BASE_URL = "https://www.petrapay.xyz";

export type PaymentType = "link" | "checkout";

export type PaymentStatus = "OPEN" | "PROCESSING" | "PAID";

export type PaymentEvent = {
  /** The checkout created for this payment. Use it to look the payment up later. */
  checkoutId: string;
  /** The payment link it came from, if any. */
  linkId: string | null;
  status: PaymentStatus;
  amount: string;
  currency: "USD" | "ZEC";
};

export type CheckoutOptions = {
  /** The payment link id (from Dashboard → Payment links), or a checkout id when `type` is "checkout". */
  paymentId: string;
  /** "link" (default) for a payment link, "checkout" for a checkout created with the API. */
  type?: PaymentType;
  /** For pay-what-you-want links: the amount to fill in, e.g. "25" or "25.50". Ignored for fixed-price links. */
  amount?: string | number;
  /**
   * "popup" (default) opens a window and keeps your page open; falls back to "redirect" if the popup is blocked.
   * "redirect" sends this tab to the checkout. "tab" opens a new tab.
   */
  mode?: "popup" | "redirect" | "tab";
  /** Dim your page with a "finish paying in the PetraPay window" notice while the popup is open. Default true. */
  overlay?: boolean;
  /** Close the popup this many ms after payment completes, or false to leave it open. Default 2500. */
  autoClose?: number | false;
  /** Your PetraPay instance, if self-hosted. Default https://www.petrapay.xyz. */
  baseUrl?: string;
  /** The customer started a payment: a checkout now exists. */
  onCreated?: (event: PaymentEvent) => void;
  /** The customer's payment arrived and is being converted to ZEC. */
  onProcessing?: (event: PaymentEvent) => void;
  /**
   * The payment completed. Treat this as a signal to update your UI; confirm the payment on your
   * server (webhook or API) before fulfilling an order.
   */
  onSuccess?: (event: PaymentEvent) => void;
  /** The popup was closed. `paid` says whether a payment completed first. */
  onClose?: (result: { paid: boolean; last: PaymentEvent | null }) => void;
  /** Something went wrong opening the checkout. */
  onError?: (error: Error) => void;
};

export type CheckoutHandle = {
  /** Close the popup and overlay. */
  close: () => void;
  /** Bring the popup back to the front (reopening it if it was closed). */
  focus: () => void;
  /** The window the checkout is in, if it opened as a popup. */
  readonly window: Window | null;
};

const ID = /^[A-Za-z0-9_-]{4,64}$/;

/** The hosted page for a payment, e.g. https://www.petrapay.xyz/l/abc123?amount=25. */
export function checkoutUrl(opts: Pick<CheckoutOptions, "paymentId" | "type" | "amount" | "baseUrl">): string {
  const id = String(opts.paymentId ?? "").trim();
  if (!ID.test(id)) throw new Error(`PetraPay: "${id}" is not a valid payment id`);
  const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const path = (opts.type ?? "link") === "checkout" ? "pay" : "l";
  const url = new URL(`${base}/${path}/${encodeURIComponent(id)}`);
  if (opts.amount !== undefined && opts.amount !== null && opts.amount !== "" && path === "l") {
    url.searchParams.set("amount", String(opts.amount));
  }
  return url.toString();
}

type Message = { source: "petrapay"; version: number; type: string; data: PaymentEvent };

function isMessage(data: unknown): data is Message {
  if (!data || typeof data !== "object") return false;
  const m = data as Partial<Message>;
  return m.source === "petrapay" && typeof m.type === "string" && !!m.data && typeof m.data.checkoutId === "string";
}

/** Origins the checkout may post from: the base URL, with and without "www.". */
function allowedOrigins(baseUrl: string): Set<string> {
  const u = new URL(baseUrl);
  const host = u.host.replace(/^www\./, "");
  return new Set([`${u.protocol}//${host}`, `${u.protocol}//www.${host}`]);
}

function popupFeatures(width = 480, height = 780): string {
  const w = Math.min(width, window.screen.availWidth);
  const h = Math.min(height, window.screen.availHeight - 40);
  const left = Math.max(0, (window.screenX ?? 0) + ((window.outerWidth ?? w) - w) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + ((window.outerHeight ?? h) - h) / 2);
  return `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`;
}

/**
 * Opens the PetraPay checkout. Call it directly from a click handler, or browsers may block the popup.
 */
export function openCheckout(options: CheckoutOptions): CheckoutHandle {
  const noop: CheckoutHandle = { close() {}, focus() {}, window: null };
  if (typeof window === "undefined") return noop;

  let url: string;
  try {
    url = checkoutUrl(options);
  } catch (err) {
    options.onError?.(err as Error);
    return noop;
  }

  const mode = options.mode ?? "popup";
  if (mode === "redirect") {
    window.location.assign(url);
    return noop;
  }

  const name = `petrapay_${Date.now()}`;
  let popup = window.open(url, mode === "tab" ? "_blank" : name, mode === "tab" ? "" : popupFeatures());
  if (!popup) {
    // Blocked: continue in this tab rather than doing nothing.
    window.location.assign(url);
    return noop;
  }

  const origins = allowedOrigins(options.baseUrl ?? DEFAULT_BASE_URL);
  let last: PaymentEvent | null = null;
  const seen = new Set<string>();
  let paid = false;
  let done = false;
  let closeTimer: number | undefined;
  const overlay = options.overlay !== false && mode === "popup" ? createOverlay(() => handle.focus(), () => handle.close()) : null;

  const onMessage = (e: MessageEvent) => {
    if (e.source !== popup || !origins.has(e.origin) || !isMessage(e.data)) return;
    // The checkout re-announces its state when reloaded; report each event once.
    const key = `${e.data.type}:${e.data.data.checkoutId}`;
    if (seen.has(key)) return;
    seen.add(key);
    last = e.data.data;
    if (e.data.type === "payment.created") options.onCreated?.(last);
    else if (e.data.type === "payment.processing") {
      options.onProcessing?.(last);
      overlay?.setText("Payment received", "Converting to ZEC. You can close the PetraPay window; it finishes on its own.");
    } else if (e.data.type === "payment.paid" && !paid) {
      paid = true;
      options.onSuccess?.(last);
      overlay?.setText("Payment complete", "Thanks! You can return to the page.");
      if (options.autoClose !== false) closeTimer = window.setTimeout(() => handle.close(), options.autoClose ?? 2500);
    }
  };

  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("message", onMessage);
    window.clearInterval(watch);
    window.clearTimeout(closeTimer);
    overlay?.remove();
    options.onClose?.({ paid, last });
  };

  // There's no "closed" event for windows, so check periodically.
  const watch = window.setInterval(() => {
    if (popup?.closed) finish();
  }, 500);
  window.addEventListener("message", onMessage);

  const handle: CheckoutHandle = {
    close() {
      try {
        popup?.close();
      } catch {
        // Already gone.
      }
      finish();
    },
    focus() {
      if (popup && !popup.closed) popup.focus();
      else if (!done) popup = window.open(url, name, popupFeatures());
    },
    get window() {
      return popup;
    },
  };
  return handle;
}

// ---------- Overlay ----------

function createOverlay(onFocus: () => void, onCancel: () => void) {
  const root = document.createElement("div");
  root.setAttribute("data-petrapay-overlay", "");
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; padding: 16px;
        background: rgba(11, 10, 36, .62); backdrop-filter: blur(3px); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .card { max-width: 340px; text-align: center; color: #fff; }
      svg { width: 44px; height: 44px; }
      h2 { margin: 16px 0 6px; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
      p { margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,.78); }
      .actions { margin-top: 20px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      button { font: inherit; font-size: 14px; font-weight: 600; border-radius: 12px; padding: 10px 16px; cursor: pointer; border: 0; }
      .primary { background: #fff; color: #072ac8; }
      .ghost { background: transparent; color: rgba(255,255,255,.85); }
      .ghost:hover { color: #fff; text-decoration: underline; }
    </style>
    <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div class="card">
        ${LOGO_SVG("#fff")}
        <h2 id="pp-title">Finish paying in the PetraPay window</h2>
        <p id="pp-body">Don't see it? Click below to bring it back.</p>
        <div class="actions">
          <button class="primary" data-action="focus">Show PetraPay window</button>
          <button class="ghost" data-action="cancel">Cancel</button>
        </div>
      </div>
    </div>`;
  shadow.querySelector('[data-action="focus"]')!.addEventListener("click", onFocus);
  shadow.querySelector('[data-action="cancel"]')!.addEventListener("click", onCancel);
  document.body.appendChild(root);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return {
    setText(title: string, body: string) {
      shadow.getElementById("pp-title")!.textContent = title;
      shadow.getElementById("pp-body")!.textContent = body;
      const focus = shadow.querySelector<HTMLButtonElement>('[data-action="focus"]')!;
      focus.textContent = "Show PetraPay window";
      const cancel = shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
      cancel.textContent = "Close";
    },
    remove() {
      document.body.style.overflow = prevOverflow;
      root.remove();
    },
  };
}

/** The PetraPay hexagon mark. */
export const LOGO_SVG = (fill = "#072ac8") =>
  `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 2 28 9v14l-12 7-12-7V9z" fill="${fill}"/><path d="M16 2v28l12-7V9z" fill="#000" fill-opacity=".18"/><path d="M4 9l12 7 12-7" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="1.2"/><path d="M16 16v14" stroke="#000" stroke-opacity=".22" stroke-width="1.2"/></svg>`;
