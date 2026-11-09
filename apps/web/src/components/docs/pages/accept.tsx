import { A, C, Callout, H2, H3, List, P, Step, Steps, Table } from "../ui";

export function Invoices() {
  return (
    <>
      <P>Invoices are for billing a specific client: freelance work, a commission, a service. Each one has its own payment page and address.</P>
      <Steps>
        <Step title="Create the invoice">
          <P>
            Go to <strong>Invoices → Create invoice</strong>. Add a title, line items with quantities and prices, an optional due date and notes. Choose
            whether it&apos;s priced in USD or ZEC.
          </P>
        </Step>
        <Step title="Add who it's for (optional)">
          <P>The client&apos;s name and email appear on the invoice as &quot;Billed to&quot;.</P>
        </Step>
        <Step title="Send it">
          <P>
            Copy the link, show the QR, or use <strong>Email invoice</strong>, which opens your own mail app with the link filled in. Nothing is sent
            through PetraPay.
          </P>
        </Step>
      </Steps>

      <H2>Editing an invoice</H2>
      <P>
        Open invoices can be edited: title, client, notes, line items, currency and due date. The link doesn&apos;t change. To protect customers who
        are mid-payment, the total is locked while someone holds a live quote for it, or after they&apos;ve reported a direct ZEC payment.
      </P>
      <Callout type="note">Paid, cancelled and expired invoices can&apos;t be edited, and neither can payments made through a payment link.</Callout>

      <H2>Following a payment</H2>
      <P>
        The invoice page shows an activity timeline: when the client started paying, with which token, and when the ZEC was delivered. Cancel an open
        invoice any time; if a payment was already underway it still completes or is refunded to the client.
      </P>
    </>
  );
}

export function PaymentLinks() {
  return (
    <>
      <P>
        A payment link is reusable: share it once and anyone can pay through it. Each payment becomes its own checkout with a fresh shielded address.
      </P>

      <H2>Pricing</H2>
      <Table
        head={["Type", "Use it for"]}
        rows={[
          ["Fixed price", "Products, files, services: everyone pays the same amount."],
          ["Customer chooses", "Tips and donations. Set an optional minimum and maximum, and up to 4 suggested amounts shown as one-tap buttons."],
        ]}
      />

      <H2>Collecting information</H2>
      <P>
        Add up to 8 fields to the payment form: short text, email, phone, long text or a dropdown, each required or optional. Quick-add presets cover
        Email, Full name, Phone and Shipping address.
      </P>
      <Callout type="tip" title="Encrypted end to end">
        Answers are encrypted in the customer&apos;s browser to a key derived from your recovery phrase. PetraPay stores ciphertext it can&apos;t read;
        you see the answers decrypted in your dashboard.
      </Callout>
      <P>
        The first time you add a field, the dashboard may ask for your recovery phrase once on that device, to set up the encryption key.
      </P>

      <H2>Managing links</H2>
      <List>
        <li>Each link has a page with its QR, payment history, amount received and conversion.</li>
        <li>
          <strong>Edit</strong> a link&apos;s title, pricing or form fields at any time. The link stays the same; changes apply to new payments, and
          past payments keep their amount and answers.
        </li>
        <li>
          <strong>Pause</strong> a link to stop new payments; customers see that it&apos;s paused.
        </li>
        <li>
          You can also create and pause links <A href="/docs/api/payment-links">through the API</A>.
        </li>
      </List>
    </>
  );
}

export function Checkout() {
  return (
    <>
      <P>
        Every invoice, link, POS sale and API checkout opens the same hosted payment page. It works on any phone or computer, and the customer never needs
        a PetraPay account.
      </P>

      <H2>How customers pay</H2>
      <H3>With any token</H3>
      <List ordered>
        <li>Pick a token: popular ones are shown first, and search covers all 190+.</li>
        <li>See a live quote: exactly how much to send, fees included, and when it arrives. It refreshes every 30 seconds.</li>
        <li>Enter the refund address (or connect a wallet to fill it in). It&apos;s only used if the payment can&apos;t complete.</li>
        <li>Pay with one tap from MetaMask, Rabby, Phantom and similar wallets, or scan the deposit QR from any wallet or exchange.</li>
      </List>
      <H3>With shielded ZEC</H3>
      <P>Scan a ZIP-321 QR with Zashi or another Orchard wallet. The amount and address are filled in.</P>

      <H2>After paying</H2>
      <P>
        The page follows the payment live: detected, converting to ZEC (usually a few minutes, with a countdown), then delivered. Customers can close
        the tab; the payment finishes on its own. The link doubles as their receipt.
      </P>
      <Callout type="note">
        For API checkouts, the page shows a &quot;Back to your store&quot; link (<C>cancel_url</C>) before paying and sends the customer to your{" "}
        <C>success_url</C> afterwards.
      </Callout>
    </>
  );
}

export function PointOfSale() {
  return (
    <>
      <P>
        PetraPay POS turns an Android payment terminal into a private till. The cashier types an amount, the customer scans and pays on their phone, and
        the terminal prints the receipt when the payment lands.
      </P>
      <Callout type="note">
        Built for Android terminals with a built-in 58 mm printer, like the Senraise H10. It also runs on other Android devices; without a printer,
        receipts are skipped and customers keep their receipt link.
      </Callout>

      <H2>Set up a terminal</H2>
      <Steps>
        <Step title="Install the app">
          <P>Install the PetraPay POS APK on the terminal.</P>
        </Step>
        <Step title="Get a pairing code">
          <P>
            In the dashboard, open <strong>Point of sale → Get pairing code</strong>. The code works once and expires after 10 minutes.
          </P>
        </Step>
        <Step title="Pair">
          <P>On the terminal, enter the code and a name for it (e.g. Front counter). It&apos;s ready to take payments.</P>
        </Step>
      </Steps>
      <Callout type="tip" title="Terminals can only take payments">
        A terminal&apos;s access is limited to ringing up and viewing its own sales. It can&apos;t withdraw, see your other invoices or change settings.
        Remove a terminal from the dashboard at any time and it stops working immediately.
      </Callout>

      <H2>Taking a payment</H2>
      <List ordered>
        <li>
          Tap <strong>Charge a customer</strong> and type the amount in USD or ZEC.
        </li>
        <li>The terminal shows a QR with a 15-minute timer.</li>
        <li>The customer scans it with their phone camera and pays on the hosted checkout, with any token or shielded ZEC.</li>
        <li>The terminal shows &quot;Payment received&quot;, then Paid, and prints the customer receipt automatically.</li>
      </List>
      <P>Reprint a receipt or print a merchant copy from the sale. The receipt has a QR linking to the online receipt.</P>

      <H2>Settings on the terminal</H2>
      <Table
        head={["Setting", "What it does"]}
        rows={[
          ["Charge in", "Default currency for new sales."],
          ["Print automatically", "Print the customer receipt when a payment completes."],
          ["Print a test page", "Check the printer and paper."],
          ["Unpair", "Sign this terminal out. Past sales stay in your dashboard."],
        ]}
      />

      <H2>Test mode</H2>
      <P>
        Turn on <strong>Test mode</strong> for a terminal in the dashboard to try the whole flow without money. See{" "}
        <A href="/docs/testing">Testing</A>.
      </P>
    </>
  );
}

export function Withdrawals() {
  return (
    <>
      <P>
        Your ZEC is yours to keep shielded. When you need another currency, a withdrawal swaps ZEC into any supported token and delivers it on the chain
        you choose.
      </P>
      <Steps>
        <Step title="Choose what to receive">
          <P>
            In <strong>Withdrawals → New withdrawal</strong>, pick the token and chain (e.g. USDC on Base) and enter the address to deliver to.
          </P>
        </Step>
        <Step title="Review the quote">
          <P>See exactly how much you&apos;ll receive for the ZEC you send.</P>
        </Step>
        <Step title="Send ZEC from your wallet">
          <P>Scan the deposit QR with Zashi. A countdown shows the time left to send; the swap starts once your ZEC arrives.</P>
        </Step>
      </Steps>
      <Callout type="warning" title="One amount becomes public">
        The deposit address for a withdrawal is transparent, so the amount you send is visible on-chain. Where it came from stays shielded. If a
        withdrawal can&apos;t complete, the ZEC is refunded to your shielded address.
      </Callout>
    </>
  );
}
