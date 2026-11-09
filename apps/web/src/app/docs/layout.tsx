import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/shell";

export const metadata: Metadata = {
  title: { default: "PetraPay Docs", template: "%s · PetraPay Docs" },
  description: "Guides and API reference for accepting private payments in any token with PetraPay.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
