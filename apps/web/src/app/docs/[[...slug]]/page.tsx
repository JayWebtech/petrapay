import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { ALL_PAGES, docHref, findPage } from "@/components/docs/nav";
import { Checkout, Invoices, PaymentLinks, PointOfSale, Withdrawals } from "@/components/docs/pages/accept";
import { ApiCheckouts, ApiOverview, ApiPaymentLinks, Testing, WebhookSignatures, Webhooks } from "@/components/docs/pages/developers";
import { Concepts, Introduction, Quickstart } from "@/components/docs/pages/getting-started";
import { Fees, Faq, Privacy, SelfHosting } from "@/components/docs/pages/resources";
import { TableOfContents } from "@/components/docs/shell";

const CONTENT: Record<string, ComponentType> = {
  "": Introduction,
  quickstart: Quickstart,
  concepts: Concepts,
  invoices: Invoices,
  "payment-links": PaymentLinks,
  checkout: Checkout,
  "point-of-sale": PointOfSale,
  withdrawals: Withdrawals,
  api: ApiOverview,
  "api/checkouts": ApiCheckouts,
  "api/payment-links": ApiPaymentLinks,
  webhooks: Webhooks,
  "webhooks/signatures": WebhookSignatures,
  testing: Testing,
  privacy: Privacy,
  fees: Fees,
  "self-hosting": SelfHosting,
  faq: Faq,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.map((p) => ({ slug: p.slug ? p.slug.split("/") : [] }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const { slug } = await params;
  const found = findPage((slug ?? []).join("/"));
  if (!found) return {};
  return found.page.slug ? { title: found.page.title, description: found.page.description } : { description: found.page.description };
}

export default async function DocPage({ params }: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await params;
  const key = (slug ?? []).join("/");
  const found = findPage(key);
  const Content = CONTENT[key];
  if (!found || !Content) notFound();
  const { page, prev, next } = found;

  return (
    <div className="flex">
      <main className="min-w-0 flex-1 px-4 pt-10 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[760px]">
          <p className="text-sm font-semibold text-primary">{page.group}</p>
          <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight sm:text-[36px]">{page.title}</h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">{page.description}</p>

          <article className="mt-8">
            <Content />
          </article>

          <nav className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={docHref(prev.slug)} className="group rounded-2xl border border-border p-4 transition-colors hover:border-primary/40">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronLeft className="size-3.5" /> Previous
                </span>
                <span className="mt-1 block font-semibold group-hover:text-primary">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link href={docHref(next.slug)} className="group rounded-2xl border border-border p-4 text-right transition-colors hover:border-primary/40">
                <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  Next <ChevronRight className="size-3.5" />
                </span>
                <span className="mt-1 block font-semibold group-hover:text-primary">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </div>
      </main>
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[240px] shrink-0 overflow-y-auto py-10 pr-6 xl:block">
        <TableOfContents />
      </aside>
    </div>
  );
}
