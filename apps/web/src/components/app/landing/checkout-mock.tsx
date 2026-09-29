import { Check, ChevronDown, Lock } from "lucide-react";
import { TokenIcon } from "../token-icon";

/** Static illustration of the checkout, so visitors see the client's side at a glance. */
export function CheckoutMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[32px] bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="card relative overflow-hidden">
        <div className="border-b border-border p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Invoice #042 · Ada Studio</span>
            <span className="rounded-full bg-muted px-2 py-0.5">Due Oct 12</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Brand identity: logo & guidelines</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular">$1,250.00</p>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs font-medium text-muted-foreground">Pay with</p>
          <div className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-background px-3">
            <TokenIcon symbol="USDC" chain="base" size={30} />
            <div className="flex-1">
              <p className="text-sm font-medium">USDC</p>
              <p className="text-xs text-muted-foreground">on Base</p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">You send</span>
              <span className="font-medium tabular">1,262.41 USDC</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Creator receives</span>
              <span className="inline-flex items-center gap-1.5 font-medium tabular">
                <Lock className="size-3.5 text-primary" />
                0.8474 ZEC
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Arrives in</span>
              <span className="tabular">~2 min</span>
            </div>
          </div>
          <div className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground">
            Pay with wallet
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" /> Settles to a single-use shielded address
          </p>
        </div>
      </div>
    </div>
  );
}
