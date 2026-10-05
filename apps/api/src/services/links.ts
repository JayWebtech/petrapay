import type { CreateLinkInput } from "@petrapay/shared";
import { prisma, type Creator } from "../db.ts";
import { badRequest } from "../lib/http.ts";
import { publicId } from "../lib/ids.ts";

const MIN = { USD: 1, ZEC: 0.001 } as const;
const DECIMALS = { USD: 2, ZEC: 8 } as const;

export function checkPrecision(value: string, currency: "USD" | "ZEC", label: string) {
  const frac = value.split(".")[1] ?? "";
  if (frac.length > DECIMALS[currency]) throw badRequest(`${label} can have at most ${DECIMALS[currency]} decimals`);
  if (Number(value) < MIN[currency]) throw badRequest(`${label} must be at least ${currency === "USD" ? "$1.00" : "0.001 ZEC"}`);
}

/** Validates and creates a payment link. Used by the dashboard and the public API. */
export async function createPaymentLink(creator: Creator, body: CreateLinkInput) {
  if (body.amountType === "FIXED") checkPrecision(body.amount!, body.currency, "Price");
  if (body.minAmount) checkPrecision(body.minAmount, body.currency, "Minimum");
  if (body.maxAmount) checkPrecision(body.maxAmount, body.currency, "Maximum");
  for (const p of body.presets) checkPrecision(p, body.currency, "Suggested amount");
  if (body.fields.length > 0 && !creator.boxPublicKey) {
    throw badRequest("Set up encrypted responses before collecting fields. Sign in again with your recovery phrase on this device.");
  }
  if ((await prisma.shieldedAddress.count({ where: { creatorId: creator.id } })) === 0) {
    throw badRequest("Add a shielded Zcash address before creating payment links.");
  }

  const fixed = body.amountType === "FIXED";
  return prisma.paymentLink.create({
    data: {
      id: publicId(),
      creatorId: creator.id,
      title: body.title,
      description: body.description || null,
      currency: body.currency,
      amountType: body.amountType,
      amount: fixed ? body.amount : null,
      minAmount: fixed ? null : (body.minAmount ?? null),
      maxAmount: fixed ? null : (body.maxAmount ?? null),
      presets: fixed ? [] : body.presets,
      fields: body.fields,
    },
  });
}
