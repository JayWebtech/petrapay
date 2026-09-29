/** Which payment this browser started for an invoice, so a reload (or the hop from a payment link) resumes it. */
export const paymentKey = (invoiceId: string) => `pp_payment_${invoiceId}`;

export function rememberPayment(invoiceId: string, swapId: string) {
  try {
    localStorage.setItem(paymentKey(invoiceId), swapId);
  } catch {
    // Private mode: payment still works, it just won't resume after reload.
  }
}
