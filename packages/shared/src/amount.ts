/** Decimal-string <-> base-unit conversion without floating point. */

export function toBaseUnits(value: string, decimals: number): bigint {
  const v = value.trim();
  if (!/^\d*(\.\d*)?$/.test(v) || v === "" || v === ".") throw new Error(`Invalid amount: ${value}`);
  const [whole = "0", frac = ""] = v.split(".");
  if (frac.length > decimals) {
    // Round down anything past the token's precision.
    return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.slice(0, decimals) || "0");
  }
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

export function fromBaseUnits(value: bigint | string, decimals: number): string {
  const n = BigInt(value);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = decimals > 0 ? (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Converts a USD amount to base units of a token priced in USD, rounding up. */
export function usdToBaseUnits(usd: string, priceUsd: number, decimals: number): bigint {
  if (!(priceUsd > 0)) throw new Error("Token price unavailable");
  // Work in micro-USD and a fixed 1e12 price scale to keep integer math.
  const microUsd = toBaseUnits(usd, 6);
  const priceScaled = BigInt(Math.round(priceUsd * 1e12));
  const numerator = microUsd * 10n ** BigInt(decimals) * 1_000_000n;
  const denominator = priceScaled;
  return (numerator + denominator - 1n) / denominator;
}

export function formatAmount(value: string | number, maxFractionDigits = 6): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  if (n !== 0 && Math.abs(n) < 10 ** -maxFractionDigits) return `<${10 ** -maxFractionDigits}`;
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
}

export function formatUsd(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "$—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
