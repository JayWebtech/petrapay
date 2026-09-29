import { addAddressSchema, addAddressesSchema, checkSettlementAddress, type AddressDTO } from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma, type ShieldedAddress } from "../db.ts";
import { HttpError, badRequest, notFound, parseBody } from "../lib/http.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";

function toAddressDTO(a: ShieldedAddress & { invoices: { id: string }[] }): AddressDTO {
  return {
    id: a.id,
    address: a.address,
    label: a.label,
    orchard: a.hasOrchard,
    sapling: a.hasSapling,
    transparent: a.hasTransparent,
    isDefault: a.isDefault,
    usedByInvoice: a.invoices[0]?.id ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function addressRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  app.get("/addresses", async (req) => {
    const rows = await prisma.shieldedAddress.findMany({
      where: { creatorId: creatorOf(req).id },
      include: { invoices: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: [{ isDefault: "desc" }, { assignedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    });
    return rows.map(toAddressDTO);
  });

  /** Accepts one address (`address`) or a batch (`addresses`) pasted from a wallet. */
  app.post("/addresses", async (req) => {
    const creatorId = creatorOf(req).id;
    const body = req.body as Record<string, unknown> | undefined;
    const input = Array.isArray(body?.addresses)
      ? parseBody(addAddressesSchema, req)
      : (() => {
          const single = parseBody(addAddressSchema, req);
          return { addresses: [single.address], label: single.label };
        })();

    const unique = [...new Set(input.addresses.map((a) => a.trim()))];
    const checked = unique.map((address) => ({ address, check: checkSettlementAddress(address) }));
    const invalid = checked.filter((c) => !c.check.ok);
    if (invalid.length > 0) {
      const first = invalid[0]!;
      throw badRequest(
        unique.length === 1 ? (first.check as { error: string }).error : `${invalid.length} of ${unique.length} addresses are invalid: ${(first.check as { error: string }).error}`,
        invalid.map((i) => ({ address: i.address, error: (i.check as { error: string }).error })),
      );
    }

    const existingCount = await prisma.shieldedAddress.count({ where: { creatorId } });
    const created = await prisma.shieldedAddress.createMany({
      data: checked.map(({ address, check }, i) => {
        const r = check.ok ? check.receivers : null;
        return {
          creatorId,
          address,
          label: input.label || null,
          hasOrchard: r?.orchard ?? false,
          hasSapling: r?.sapling ?? false,
          hasTransparent: r?.transparent ?? false,
          // The very first address becomes the fallback used when the pool runs dry.
          isDefault: existingCount === 0 && i === 0,
        };
      }),
      skipDuplicates: true,
    });
    return { added: created.count, skipped: unique.length - created.count };
  });

  app.post<{ Params: { id: string } }>("/addresses/:id/default", async (req) => {
    const creatorId = creatorOf(req).id;
    const address = await prisma.shieldedAddress.findFirst({ where: { id: req.params.id, creatorId } });
    if (!address) throw notFound("Address not found");
    await prisma.$transaction([
      prisma.shieldedAddress.updateMany({ where: { creatorId }, data: { isDefault: false } }),
      prisma.shieldedAddress.update({ where: { id: address.id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/addresses/:id", async (req) => {
    const creatorId = creatorOf(req).id;
    const address = await prisma.shieldedAddress.findFirst({
      where: { id: req.params.id, creatorId },
      include: { _count: { select: { invoices: true } } },
    });
    if (!address) throw notFound("Address not found");
    if (address._count.invoices > 0) throw new HttpError(409, "This address is linked to an invoice and can't be removed.");
    await prisma.shieldedAddress.delete({ where: { id: address.id } });
    if (address.isDefault) {
      const next = await prisma.shieldedAddress.findFirst({ where: { creatorId }, orderBy: { createdAt: "asc" } });
      if (next) await prisma.shieldedAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  });
}
