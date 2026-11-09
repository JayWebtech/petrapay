# petrapay

Add a **Pay with PetraPay** button to any website. Customers pay with any token they hold (USDC, ETH, SOL, BTC and 190+ more), and you receive **shielded Zcash**. Non-custodial: funds go straight to your own wallet.

- Works with any site: React/Next.js component, `<petrapay-button>` web component, or plain JavaScript
- Opens the hosted checkout in a popup, so customers never leave your page
- Tells your page when the payment is created, processing and paid
- No API key in the browser; ~9 KB script-tag build, zero dependencies

## 1. Create a payment link

In the [PetraPay dashboard](https://www.petrapay.xyz/dashboard/links), create a payment link and copy its id (the part after `/l/` in the link). Use **Customer chooses** pricing if your site passes the amount, or **Fixed price** for a single product.

## 2. Add the button

### React / Next.js

```bash
npm install petrapay
```

```tsx
import { PetraPayButton } from "petrapay/react";

export function Checkout({ total }: { total: number }) {
  return (
    <PetraPayButton
      paymentId="YOUR_LINK_ID"
      amount={total}
      onSuccess={(payment) => console.log("Paid", payment.checkoutId)}
    />
  );
}
```

Works in the Next.js App Router (the component is marked `"use client"`).

Prefer your own button? Use the hook:

```tsx
import { usePetraPay } from "petrapay/react";

const { open, status } = usePetraPay({ paymentId: "YOUR_LINK_ID", onSuccess: (p) => markPaid(p.checkoutId) });
<button onClick={() => open({ amount: cart.total })}>Pay with crypto</button>;
```

### Plain HTML (no build step)

```html
<script src="https://unpkg.com/petrapay@0.1/dist/petrapay.global.js"></script>

<petrapay-button payment-id="YOUR_LINK_ID" amount="25"></petrapay-button>

<script>
  document.querySelector("petrapay-button").addEventListener("petrapay:success", (e) => {
    console.log("Paid", e.detail.checkoutId);
  });
</script>
```

Attributes: `payment-id`, `amount`, `type`, `label`, `theme` (`dark` | `light`), `size` (`small` | `medium` | `large`), `block`, `mode`, `base-url`.
Events: `petrapay:created`, `petrapay:processing`, `petrapay:success`, `petrapay:close`, `petrapay:error`.

### Any framework (Vue, Svelte, vanilla JS)

```js
import { openCheckout, mountButton } from "petrapay";

// Your own button: call it from the click handler so the popup isn't blocked.
button.addEventListener("click", () => {
  openCheckout({ paymentId: "YOUR_LINK_ID", amount: 25, onSuccess: (p) => console.log(p) });
});

// Or render the PetraPay button into an element.
mountButton("#pay", { paymentId: "YOUR_LINK_ID", amount: 25, block: true });
```

### React Native / Expo

Popups don't exist in native apps; open the hosted page in an in-app browser instead:

```ts
import * as WebBrowser from "expo-web-browser";
import { checkoutUrl } from "petrapay";

await WebBrowser.openBrowserAsync(checkoutUrl({ paymentId: "YOUR_LINK_ID", amount: 25 }));
```

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `paymentId` | `string` | required | Payment link id, or a checkout id with `type: "checkout"` |
| `type` | `"link" \| "checkout"` | `"link"` | Use `"checkout"` for checkouts created with the [API](https://www.petrapay.xyz/docs/api/checkouts) |
| `amount` | `string \| number` | | Fills in the amount on pay-what-you-want links (ignored for fixed-price links) |
| `mode` | `"popup" \| "redirect" \| "tab"` | `"popup"` | Falls back to redirect if the popup is blocked |
| `overlay` | `boolean` | `true` | Dims your page while the popup is open |
| `autoClose` | `number \| false` | `2500` | Closes the popup this many ms after payment |
| `baseUrl` | `string` | `https://www.petrapay.xyz` | For self-hosted instances |
| `onCreated` | `(payment) => void` | | A checkout was created for this customer |
| `onProcessing` | `(payment) => void` | | Payment arrived, converting to ZEC |
| `onSuccess` | `(payment) => void` | | Payment complete |
| `onClose` | `({ paid, last }) => void` | | The popup was closed |
| `onError` | `(error) => void` | | The checkout couldn't be opened |

Button props (`PetraPayButton`, `mountButton`): `label`, `theme`, `size`, `block`, plus `disabled`, `className`, `style` and `children` in React.

`payment` is `{ checkoutId, linkId, status, amount, currency }`.

## Confirm payments on your server

`onSuccess` runs in the customer's browser, so treat it as a UI signal. Before shipping an order or granting access, confirm the payment on your server with a [webhook](https://www.petrapay.xyz/docs/webhooks) (`checkout.paid`) or by fetching the checkout with the [API](https://www.petrapay.xyz/docs/api/checkouts).

## Links

- [Documentation](https://www.petrapay.xyz/docs)
- [Dashboard](https://www.petrapay.xyz/dashboard)
- [Source](https://github.com/JayWebtech/petrapay/tree/main/packages/petrapay-js)

MIT © Jethro Adamu
