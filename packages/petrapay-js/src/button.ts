import { LOGO_SVG, openCheckout, type CheckoutHandle, type CheckoutOptions } from "./core";

export type ButtonTheme = "dark" | "light";
export type ButtonSize = "small" | "medium" | "large";

export type ButtonAppearance = {
  /** Button text. Default "Pay with PetraPay". */
  label?: string;
  /** "dark" (PetraPay blue, default) or "light" (white with a border). */
  theme?: ButtonTheme;
  size?: ButtonSize;
  /** Stretch to the container's width. */
  block?: boolean;
};

const HEIGHT: Record<ButtonSize, number> = { small: 36, medium: 44, large: 52 };
const FONT: Record<ButtonSize, number> = { small: 14, medium: 15, large: 16 };

/** Inline styles shared by the plain-JS button, the web component and the React component. */
export function buttonStyle({ theme = "dark", size = "medium", block = false }: ButtonAppearance, disabled = false): Record<string, string> {
  const dark = theme === "dark";
  return {
    display: block ? "flex" : "inline-flex",
    width: block ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    height: `${HEIGHT[size]}px`,
    padding: `0 ${size === "small" ? 14 : 20}px`,
    borderRadius: size === "small" ? "10px" : "12px",
    border: dark ? "1px solid #072ac8" : "1px solid #d9d7e6",
    background: dark ? "#072ac8" : "#ffffff",
    color: dark ? "#ffffff" : "#0b0a24",
    boxShadow: dark ? "0 2px 0 0 #031a85" : "0 2px 0 0 #e6e4f0",
    font: `600 ${FONT[size]}px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    letterSpacing: "-0.005em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.6" : "1",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    transition: "transform .08s ease, filter .15s ease",
    WebkitTapHighlightColor: "transparent",
  };
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^webkit/, "-webkit");
const cssText = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([k, v]) => `${kebab(k)}:${v}`)
    .join(";");

export type MountOptions = CheckoutOptions & ButtonAppearance;

/**
 * Renders a "Pay with PetraPay" button into `target` (an element or a CSS selector).
 * Returns a function that removes it.
 */
export function mountButton(target: Element | string, options: MountOptions): () => void {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!host) throw new Error(`PetraPay: no element matches "${String(target)}"`);
  const button = document.createElement("button");
  button.type = "button";
  renderButton(button, options);
  let handle: CheckoutHandle | null = null;
  button.addEventListener("click", () => {
    handle = openCheckout(options);
  });
  host.appendChild(button);
  return () => {
    handle?.close();
    button.remove();
  };
}

function renderButton(button: HTMLButtonElement, options: ButtonAppearance) {
  const logoColor = (options.theme ?? "dark") === "dark" ? "#ffffff" : "#072ac8";
  button.setAttribute("style", cssText(buttonStyle(options)));
  button.innerHTML = `<span style="display:inline-flex;width:20px;height:20px">${LOGO_SVG(logoColor)}</span><span></span>`;
  button.lastElementChild!.textContent = options.label ?? "Pay with PetraPay";
  button.addEventListener("pointerdown", () => (button.style.transform = "translateY(1px)"));
  const up = () => (button.style.transform = "");
  button.addEventListener("pointerup", up);
  button.addEventListener("pointerleave", up);
  button.addEventListener("mouseenter", () => (button.style.filter = "brightness(1.08)"));
  button.addEventListener("mouseleave", () => (button.style.filter = ""));
}

/**
 * <petrapay-button payment-id="abc123" amount="25" label="Pay with crypto"></petrapay-button>
 *
 * Fires bubbling DOM events: petrapay:created, petrapay:processing, petrapay:success (detail: the payment)
 * and petrapay:close (detail: { paid, last }).
 */
export function defineButtonElement(tag = "petrapay-button") {
  if (typeof window === "undefined" || !("customElements" in window) || customElements.get(tag)) return;

  class PetraPayButtonElement extends HTMLElement {
    static observedAttributes = ["payment-id", "type", "amount", "label", "theme", "size", "block", "base-url", "mode"];
    #button: HTMLButtonElement | null = null;
    #handle: CheckoutHandle | null = null;

    connectedCallback() {
      this.render();
    }

    disconnectedCallback() {
      this.#handle?.close();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    private options(): MountOptions {
      const attr = (n: string) => this.getAttribute(n) ?? undefined;
      const emit = (name: string, detail: unknown) => this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
      return {
        paymentId: attr("payment-id") ?? "",
        type: attr("type") === "checkout" ? "checkout" : "link",
        amount: attr("amount"),
        baseUrl: attr("base-url"),
        mode: (attr("mode") as MountOptions["mode"]) ?? "popup",
        label: attr("label"),
        theme: attr("theme") === "light" ? "light" : "dark",
        size: (attr("size") as ButtonSize) ?? "medium",
        block: this.hasAttribute("block"),
        onCreated: (e) => emit("petrapay:created", e),
        onProcessing: (e) => emit("petrapay:processing", e),
        onSuccess: (e) => emit("petrapay:success", e),
        onClose: (r) => emit("petrapay:close", r),
        onError: (err) => emit("petrapay:error", err),
      };
    }

    private render() {
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const opts = this.options();
      root.innerHTML = `<style>:host{display:${opts.block ? "block" : "inline-block"}}</style>`;
      this.#button = document.createElement("button");
      this.#button.type = "button";
      this.#button.part.add("button");
      renderButton(this.#button, opts);
      this.#button.addEventListener("click", () => {
        this.#handle = openCheckout(this.options());
      });
      root.appendChild(this.#button);
    }
  }

  customElements.define(tag, PetraPayButtonElement);
}
