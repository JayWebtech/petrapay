import { Check, Lock, Printer } from "lucide-react";
import { LogoMark } from "../logo";

// A fixed, QR-looking pattern for the illustration (not a scannable code).
const SIZE = 21;
const CELLS = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  const finder = (fx: number, fy: number) => {
    const dx = x - fx;
    const dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const f = finder(0, 0) ?? finder(SIZE - 7, 0) ?? finder(0, SIZE - 7);
  if (f !== null) return f;
  if ((x === 7 || y === 7 || x === SIZE - 8 || y === SIZE - 8) && (x < 8 || y < 8 || x > SIZE - 9)) return false;
  // Leave the middle clear for the logo.
  if (x >= 8 && x <= 12 && y >= 8 && y <= 12) return false;
  return ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
});

/** Illustration of a payment terminal showing a sale's QR, with the receipt printing out of it. */
export function PosShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-[400px] pb-6">
      <div className="absolute -inset-8 rounded-[40px] bg-primary/10 blur-3xl" aria-hidden="true" />

      {/* Receipt, coming out of the top of the terminal */}
      <div className="relative z-0 mx-auto -mb-6 w-[78%] origin-bottom rounded-t-md bg-white px-5 pt-5 pb-10 font-mono text-[11px] leading-relaxed text-[#2c2a40] shadow-[0_10px_30px_-12px_rgba(17,15,36,0.25)] ring-1 ring-black/5 [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
        <p className="text-center text-[13px] font-bold">Corner Café</p>
        <p className="mt-1 text-center font-bold">PAYMENT RECEIPT</p>
        <p className="my-2 border-t border-dashed border-[#c9c7d8]" />
        <p className="flex justify-between">
          <span>Sale</span>
          <span>#0042</span>
        </p>
        <p className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>USD 12.50</span>
        </p>
        <p className="flex justify-between">
          <span>Paid with</span>
          <span>12.53 USDC</span>
        </p>
        <p className="flex justify-between">
          <span>Network</span>
          <span>Base</span>
        </p>
        <p className="flex justify-between font-bold">
          <span>Status</span>
          <span>PAID</span>
        </p>
        <p className="my-2 border-t border-dashed border-[#c9c7d8]" />
        <p className="text-center">Paid privately with PetraPay</p>
      </div>

      {/* Terminal */}
      <div className="relative z-10 rounded-[34px] bg-[#16152e] p-3 shadow-[0_40px_80px_-30px_rgba(11,10,36,0.7)] ring-1 ring-white/10">
        <div className="mx-auto mb-2 h-1.5 w-24 rounded-full bg-[#2c2b4d]" aria-hidden="true" />
        <div className="overflow-hidden rounded-[24px] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <LogoMark className="size-4" /> Corner Café
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 tabular">14:52</span>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">Scan to pay</p>
          <p className="text-center text-4xl font-semibold tracking-tight tabular">
            $12<span className="text-foreground/35">.50</span>
          </p>
          <div className="relative mx-auto mt-5 grid size-44 grid-cols-[repeat(21,1fr)] gap-0 rounded-2xl border border-border bg-white p-3" aria-hidden="true">
            {CELLS.map((on, i) => (
              <span key={i} className={on ? "bg-[#110f24]" : ""} />
            ))}
            <span className="absolute inset-0 m-auto grid size-9 place-items-center rounded-lg bg-white">
              <LogoMark className="size-6" />
            </span>
          </div>
          <p className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full bg-[#eef1fd] px-3 py-1.5 text-xs font-medium text-primary">
            <Lock className="size-3.5" /> Any token, or shielded ZEC
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 px-1" aria-hidden="true">
          {["1", "2", "3"].map((k) => (
            <span key={k} className="grid h-9 place-items-center rounded-xl bg-[#22213f] text-sm text-white/70">
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Paid toast */}
      <div className="absolute top-[46%] -right-4 z-20 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgba(17,15,36,0.45)] ring-1 ring-black/5 sm:-right-10">
        <span className="grid size-8 place-items-center rounded-full bg-[#e7f6ec] text-[#0e6b35]">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="text-left">
          <span className="block text-xs font-semibold">Paid · $12.50</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Printer className="size-3" /> Printing receipt
          </span>
        </span>
      </div>
    </div>
  );
}
