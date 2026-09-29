import { formatAmount, formatUsd, type PublicLinkDTO } from "@petrapay/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api";
import { LinkCheckout } from "./link-checkout";

async function load(id: string) {
  return serverApi<PublicLinkDTO>(`/public/links/${encodeURIComponent(id)}`);
}

export async function generateMetadata({ params }: PageProps<"/l/[id]">): Promise<Metadata> {
  const { id } = await params;
  const link = await load(id);
  if (!link) return { title: "Payment link not found" };
  const price = link.amount ? (link.currency === "USD" ? formatUsd(link.amount) : `${formatAmount(link.amount, 8)} ZEC`) : null;
  return {
    title: `${price ? `${price} · ` : ""}${link.title} · ${link.creatorName}`,
    description: `${link.description ?? link.title}. Pay ${link.creatorName} with USDC, SOL, ETH or 100+ other tokens.`,
    robots: { index: false, follow: false },
  };
}

export default async function LinkPage({ params }: PageProps<"/l/[id]">) {
  const { id } = await params;
  const link = await load(id);
  if (!link) notFound();
  return <LinkCheckout link={link} />;
}
