import { formatAmount, formatUsd, type PublicInvoiceDTO } from "@petrapay/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api";
import { Checkout } from "./checkout";

async function load(id: string) {
  return serverApi<PublicInvoiceDTO>(`/public/invoices/${encodeURIComponent(id)}`);
}

export async function generateMetadata({ params }: PageProps<"/pay/[id]">): Promise<Metadata> {
  const { id } = await params;
  const invoice = await load(id);
  if (!invoice) return { title: "Invoice not found" };
  const amount = invoice.currency === "USD" ? formatUsd(invoice.amount) : `${formatAmount(invoice.amount, 8)} ZEC`;
  return {
    title: `${amount} · ${invoice.creatorName}`,
    description: `${invoice.title}. Pay with USDC, SOL, ETH or 100+ other tokens.`,
    robots: { index: false, follow: false },
  };
}

export default async function PayPage({ params, searchParams }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const { method } = await searchParams;
  const invoice = await load(id);
  if (!invoice) notFound();
  // Payment links hand over with ?method=zec when the payer chose to pay from a Zcash wallet.
  return <Checkout initial={invoice} initialView={method === "zec" ? "zec" : "choose"} />;
}
