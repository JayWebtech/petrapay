"use client";

import { formatAmount, formatUsd, type InvoiceDTO } from "@petrapay/shared";
import {
  ArrowUpRight,
  ChevronsUpDown,
  FileText,
  Home,
  KeyRound,
  Link2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/app/auth-provider";
import { LogoMark } from "@/components/app/logo";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import { Loader } from "@/components/motion/loader";
import { api } from "@/lib/api";
import { fingerprint } from "@/lib/identity";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; alsoMatches?: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/links", label: "Payment links", icon: Link2 },
  { href: "/dashboard/withdrawals", label: "Withdrawals", icon: ArrowUpRight, alsoMatches: ["/dashboard/withdraw"] },
  { href: "/dashboard/addresses", label: "Shielded addresses", icon: Shield },
];

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : [item.href, ...(item.alsoMatches ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function DashboardShell({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);

  useEffect(() => {
    if (status === "anon") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  // Invoices are searchable from ⌘K; load them when the palette opens.
  useEffect(() => {
    if (!paletteOpen) return;
    api<InvoiceDTO[]>("/invoices")
      .then(setInvoices)
      .catch(() => undefined);
  }, [paletteOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      { id: "new-invoice", label: "Create invoice", group: "Actions", icon: Plus, hint: "N", onSelect: go("/dashboard/invoices/new") },
      { id: "new-link", label: "Create payment link", group: "Actions", icon: Link2, onSelect: go("/dashboard/links/new") },
      { id: "add-addresses", label: "Add shielded addresses", group: "Actions", icon: Shield, onSelect: go("/dashboard/addresses") },
      { id: "withdraw", label: "New withdrawal (ZEC to any chain)", group: "Actions", icon: ArrowUpRight, onSelect: go("/dashboard/withdraw") },
      ...NAV.map((n) => ({ id: `nav-${n.href}`, label: `Go to ${n.label}`, group: "Navigation", icon: n.icon, onSelect: go(n.href) })),
      { id: "nav-settings", label: "Go to Settings", group: "Navigation", icon: Settings, onSelect: go("/dashboard/settings") },
      ...invoices.slice(0, 30).map((inv) => ({
        id: `inv-${inv.id}`,
        label: `#${String(inv.number).padStart(3, "0")} ${inv.title}`,
        group: "Invoices",
        icon: FileText,
        hint: inv.currency === "USD" ? formatUsd(inv.amount) : `${formatAmount(inv.amount, 4)} ZEC`,
        keywords: [inv.id, inv.status.toLowerCase()],
        onSelect: go(`/dashboard/invoices/${inv.id}`),
      })),
    ];
  }, [invoices, router]);

  // "N" anywhere (outside inputs) starts a new invoice, like Stripe's shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "n" && !paletteOpen) router.push("/dashboard/invoices/new");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, paletteOpen]);

  if (status !== "authed" || !me) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader variant="dots" size={28} label="Loading your account" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-border bg-[#fbfbfd] md:flex">
        <SidebarContents pathname={pathname} freshAddresses={me.freshAddresses} totalAddresses={me.totalAddresses} />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-[#110f24]/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-[#fbfbfd] shadow-2xl"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 left-[calc(100%+12px)] grid size-9 place-items-center rounded-full bg-white text-foreground shadow-lg"
              >
                <X className="size-4" />
              </button>
              <SidebarContents
                pathname={pathname}
                freshAddresses={me.freshAddresses}
                totalAddresses={me.totalAddresses}
                onNavigate={() => setMobileOpen(false)}
                layoutId="nav-active-mobile"
              />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="md:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/85 px-4 backdrop-blur-xl md:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-transparent bg-[#f4f3f8] px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-white"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Search invoices, pages and actions</span>
            <kbd className="hidden rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] font-medium sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/dashboard/invoices/new"
              className="press inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[0_2px_0_0_#271a95] transition-colors"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Create invoice</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} placeholder="Search invoices, pages and actions…" />
    </div>
  );
}

function SidebarContents({
  pathname,
  freshAddresses,
  totalAddresses,
  onNavigate,
  layoutId = "nav-active",
}: {
  pathname: string;
  freshAddresses: number;
  totalAddresses: number;
  onNavigate?: () => void;
  layoutId?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <div className="p-3">
        <AccountMenu />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2" aria-label="Dashboard">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const lowPool = item.href === "/dashboard/addresses" && totalAddresses > 0 && freshAddresses < 3;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                    active ? "text-primary" : "text-[#4a4860] hover:bg-[#f0eff6] hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId={layoutId}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                      className="absolute inset-0 rounded-lg bg-[#eeecfd]"
                    />
                  ) : null}
                  <item.icon className="relative size-4" />
                  <span className="relative flex-1">{item.label}</span>
                  {lowPool ? (
                    <span
                      className="relative rounded-md bg-[#fff1e6] px-1.5 text-[11px] font-semibold text-[#9a3f00] tabular"
                      title="Fresh addresses left"
                    >
                      {freshAddresses}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Shortcuts</p>
        <ul className="space-y-0.5">
          {[
            { href: "/dashboard/invoices/new", label: "New invoice", icon: Plus },
            { href: "/dashboard/links/new", label: "New payment link", icon: Link2 },
            { href: "/dashboard/withdraw", label: "Cash out ZEC", icon: ArrowUpRight },
          ].map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                onClick={onNavigate}
                className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-[#4a4860] transition-colors hover:bg-[#f0eff6] hover:text-foreground"
              >
                <s.icon className="size-4" /> {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2 p-3">
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            Shielded settlement
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Payments land in your Orchard wallet. PetraPay never holds funds.</p>
        </div>
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/settings") ? "bg-[#eeecfd] text-primary" : "text-[#4a4860] hover:bg-[#f0eff6]",
          )}
        >
          <Settings className="size-4" /> Settings
        </Link>
      </div>
    </>
  );
}

function AccountMenu() {
  const { me, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!me) return null;
  const name = me.displayName ?? "Your studio";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[#f0eff6]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#4b36e0] to-[#2a1a9e] text-xs font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <LogoMark className="size-3" /> PetraPay
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-white p-1 shadow-[0_16px_40px_-16px_rgba(17,15,36,0.35)]"
          >
            <div className="px-2.5 py-2">
              <p className="text-xs text-muted-foreground">Account key</p>
              <p className="flex items-center gap-1.5 font-mono text-xs">
                <KeyRound className="size-3" /> {fingerprint(me.publicKey)}
              </p>
            </div>
            <div className="my-1 h-px bg-border" />
            <MenuItem icon={Settings} label="Settings" onClick={() => router.push("/dashboard/settings")} />
            <MenuItem icon={LogOut} label="Sign out" onClick={() => signOut().then(() => router.replace("/"))} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-muted"
    >
      <Icon className="size-4 text-muted-foreground" /> {label}
    </button>
  );
}
