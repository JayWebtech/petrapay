import Link from "next/link";
import { LogoMark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-sm text-sm text-muted-foreground">This link may be mistyped, or the invoice no longer exists. Check with whoever sent it to you.</p>
      <Link href="/" className="press mt-2 inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium">
        Go home
      </Link>
    </div>
  );
}
