"use client";

import { ArrowUpRight, FileText, Menu, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/app/logo";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import { cn } from "@/lib/utils";
import { ALL_PAGES, DOCS, docHref } from "./nav";

/** The docs site frame: top bar with search, grouped sidebar, and the page. */
export function DocsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<CommandItem[]>(
    () =>
      ALL_PAGES.map((p) => ({
        id: p.slug || "intro",
        label: p.title,
        group: p.group,
        icon: FileText,
        keywords: [p.description, ...(p.keywords ?? [])],
        onSelect: () => router.push(docHref(p.slug)),
      })),
    [router],
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/docs" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="size-7" />
            <span className="text-[17px]">PetraPay</span>
            <span className="rounded-md bg-[#eef1fd] px-1.5 py-0.5 text-xs font-semibold text-primary">Docs</span>
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-[#fafafe] px-3 text-sm text-muted-foreground transition-colors hover:border-[#d6d3e6] md:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search docs…</span>
            <kbd className="rounded-md border border-border bg-white px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search docs"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            >
              <Search className="size-5" />
            </button>
            <Link href="/dashboard" className="hidden h-9 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">
              Dashboard
            </Link>
            <Link href="/login" className="btn-solid h-9 rounded-xl px-3.5 text-sm font-semibold">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[272px] shrink-0 overflow-y-auto border-r border-border px-4 py-8 lg:block">
          <SidebarNav pathname={pathname} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-[#0b0a24]/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[300px] overflow-y-auto bg-white px-4 py-5 shadow-2xl lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              <div className="mb-6 flex items-center justify-between px-2">
                <span className="flex items-center gap-2 font-semibold">
                  <LogoMark className="size-6" /> Docs
                </span>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="grid size-8 place-items-center rounded-lg hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
              <SidebarNav pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} items={items} placeholder="Search the docs…" />
    </div>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-7">
      {DOCS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[12px] font-semibold tracking-wide text-foreground">{group.title}</p>
          <ul className="space-y-0.5 border-l border-border">
            {group.pages.map((p) => {
              const href = docHref(p.slug);
              const active = pathname === href;
              return (
                <li key={p.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "-ml-px flex items-center border-l py-1.5 pr-2 pl-4 text-sm transition-colors",
                      active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:border-[#bdbbd0] hover:text-foreground",
                    )}
                  >
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-border pt-5">
        <Link href="/dashboard/developers" onClick={onNavigate} className="flex items-center gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground">
          API keys & webhooks <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </nav>
  );
}

/** "On this page": the page's h2/h3 headings, highlighting the one being read. */
export function TableOfContents() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("article [data-toc]"));
    // Read the headings once the page's content has painted.
    const frame = requestAnimationFrame(() =>
      setHeadings(els.map((el) => ({ id: el.id, text: el.textContent ?? "", level: Number(el.dataset.toc) }))),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  if (headings.length === 0) return null;
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-[12px] font-semibold tracking-wide">On this page</p>
      <ul className="space-y-2">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
            <a href={`#${h.id}`} className={cn("block leading-5 transition-colors", active === h.id ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
