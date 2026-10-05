import type { Metadata } from "next";
import { DocsContent } from "./docs-content";

export const metadata: Metadata = {
  title: "API docs",
  description: "Create checkouts from your server, redirect customers to a hosted payment page, and get signed webhooks when they pay in shielded ZEC.",
};

export default function DocsPage() {
  return <DocsContent />;
}
