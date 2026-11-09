import { AlertTriangle, ArrowUpRight, Info, Lightbulb, Link as LinkIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CodeBlock, type CodeSample } from "@/components/app/developers/code-block";
import { cn } from "@/lib/utils";

/** Building blocks for docs pages, in the spirit of Mintlify's components. */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function Anchor({ id }: { id: string }) {
  return (
    <a href={`#${id}`} aria-label="Link to this section" className="ml-2 inline-flex opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100">
      <LinkIcon className="size-4" />
    </a>
  );
}

export function H2({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slugify(children);
  return (
    <h2 id={anchor} data-toc="2" className="group mt-12 mb-3 scroll-mt-24 text-[22px] font-semibold tracking-tight first:mt-0">
      {children}
      <Anchor id={anchor} />
    </h2>
  );
}

export function H3({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slugify(children);
  return (
    <h3 id={anchor} data-toc="3" className="group mt-8 mb-2 scroll-mt-24 text-[17px] font-semibold tracking-tight">
      {children}
      <Anchor id={anchor} />
    </h3>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("my-4 text-[15px] leading-7 text-foreground/80", className)}>{children}</p>;
}

export function C({ children }: { children: ReactNode }) {
  return <code className="rounded-md border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

export function List({ children, ordered }: { children: ReactNode; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("my-4 space-y-2 pl-5 text-[15px] leading-7 text-foreground/80", ordered ? "list-decimal" : "list-disc marker:text-primary/60")}>{children}</Tag>
  );
}

const CALLOUTS: Record<"note" | "tip" | "warning", { icon: LucideIcon; box: string; text: string }> = {
  note: { icon: Info, box: "border-primary/20 bg-[#f5f7ff]", text: "text-primary" },
  tip: { icon: Lightbulb, box: "border-[#0e6b35]/20 bg-[#f1faf4]", text: "text-[#0e6b35]" },
  warning: { icon: AlertTriangle, box: "border-[#9a3f00]/25 bg-[#fff7ef]", text: "text-[#9a3f00]" },
};

export function Callout({ type = "note", title, children }: { type?: keyof typeof CALLOUTS; title?: string; children: ReactNode }) {
  const c = CALLOUTS[type];
  return (
    <div className={cn("my-6 flex gap-3 rounded-2xl border p-4 text-[14px] leading-6", c.box)}>
      <c.icon className={cn("mt-0.5 size-4 shrink-0", c.text)} />
      <div className="min-w-0 text-foreground/80 [&_p]:my-1">
        {title ? <p className={cn("font-semibold", c.text)}>{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="my-6 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pb-8 pl-11 [counter-increment:step] last:pb-0 before:absolute before:top-0 before:left-0 before:grid before:size-7 before:place-items-center before:rounded-full before:bg-[#eef1fd] before:text-[13px] before:font-semibold before:text-primary before:content-[counter(step)] after:absolute after:top-9 after:bottom-1 after:left-[13px] after:w-px after:bg-border last:after:hidden">
      <p className="pt-0.5 text-[15px] font-semibold">{title}</p>
      <div className="mt-1 text-[15px] leading-7 text-foreground/80 [&>p]:my-2">{children}</div>
    </li>
  );
}

export function CardGroup({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("my-6 grid gap-3", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}

export function Card({ title, href, icon: Icon, children }: { title: string; href: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl border border-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-18px_rgba(7,42,200,0.45)]"
    >
      {Icon ? (
        <span className="mb-3 grid size-9 place-items-center rounded-xl bg-[#eef1fd] text-primary">
          <Icon className="size-4.5" />
        </span>
      ) : null}
      <p className="flex items-center gap-1 text-[15px] font-semibold">
        {title}
        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
    </Link>
  );
}

export function Code({ samples, title }: { samples: CodeSample[]; title?: string }) {
  return (
    <div className="my-5">
      {title ? <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p> : null}
      <CodeBlock samples={samples} />
    </div>
  );
}

/** Parameters or fields, one row each (like Mintlify's ParamField/ResponseField). */
export function Params({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6">
      {title ? <p className="mb-1 text-[15px] font-semibold">{title}</p> : null}
      <div className="divide-y divide-border border-y border-border">{children}</div>
    </div>
  );
}

export function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="py-4">
      <p className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-[13.5px] font-semibold text-primary">{name}</code>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{type}</span>
        {required ? <span className="rounded-md bg-[#fdecec] px-1.5 py-0.5 text-[11px] font-medium text-[#b42318]">required</span> : null}
      </p>
      <div className="mt-1.5 text-[14px] leading-6 text-foreground/75 [&_p]:my-1">{children}</div>
    </div>
  );
}

const METHOD: Record<string, string> = {
  GET: "bg-[#e7f6ec] text-[#0e6b35]",
  POST: "bg-[#eef1fd] text-primary",
  PATCH: "bg-[#fff4e0] text-[#8a5300]",
  DELETE: "bg-[#fdecec] text-[#b42318]",
};

export function Endpoint({ method, path, base }: { method: keyof typeof METHOD; path: string; base?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 overflow-x-auto rounded-xl border border-border bg-[#fafafe] px-3 py-2.5">
      <span className={cn("shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-bold", METHOD[method])}>{method}</span>
      <code className="font-mono text-[13px] whitespace-nowrap">
        {base ? <span className="text-muted-foreground">{base}</span> : null}
        {path}
      </code>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[480px] text-[14px]">
        <thead>
          <tr className="border-b border-border bg-[#fafafe] text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={cn("px-4 py-2.5 align-top leading-6", j === 0 ? "font-mono text-[13px] whitespace-nowrap" : "text-foreground/80")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
