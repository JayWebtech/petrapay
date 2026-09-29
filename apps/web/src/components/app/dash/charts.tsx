"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export type Point = { label: string; value: number };

/** Monotone cubic (Fritsch–Carlson) path: smooth, never overshoots below zero or above peaks. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1]! - xs[i]!);
    slope.push((ys[i + 1]! - ys[i]!) / dx[i]!);
  }
  const m: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    m.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  m.push(slope[n - 2]!);
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3;
    d += ` C${xs[i]! + h},${ys[i]! + m[i]! * h} ${xs[i + 1]! - h},${ys[i + 1]! - m[i + 1]! * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Single-series area chart with a snapping crosshair and tooltip.
 * The card title names the series, so there is no legend. A hidden table mirrors the data.
 */
export function AreaChart({
  data,
  height = 240,
  formatValue,
  formatDetail,
  caption,
  dimmed,
}: {
  data: Point[];
  height?: number;
  formatValue: (n: number) => string;
  /** Optional secondary line in the tooltip for a point. */
  formatDetail?: (index: number) => string | null;
  caption: string;
  dimmed?: boolean;
}) {
  const reduce = useReducedMotion();
  const gradientId = useId();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const padTop = 16;
  const padBottom = 28;
  const plotH = height - padTop - padBottom;

  const geo = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 0);
    const yMax = max > 0 ? max * 1.15 : 1;
    const step = data.length > 1 ? width / (data.length - 1) : 0;
    const xs = data.map((_, i) => i * step);
    const ys = data.map((d) => padTop + plotH - (d.value / yMax) * plotH);
    const line = monotonePath(xs, ys);
    const area = xs.length ? `${line} L${xs[xs.length - 1]},${padTop + plotH} L0,${padTop + plotH} Z` : "";
    return { xs, ys, line, area, max };
  }, [data, width, plotH]);

  const locate = (clientX: number) => {
    const el = ref.current;
    if (!el || data.length === 0) return;
    const x = clientX - el.getBoundingClientRect().left;
    const step = data.length > 1 ? width / (data.length - 1) : 1;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(x / step))));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? data.length) - 1));
    else if (e.key === "Escape") setActive(null);
  };

  const ticks = data.length ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];
  const empty = geo.max === 0;
  const tip = active !== null && width > 0 ? { x: geo.xs[active]!, y: geo.ys[active]!, point: data[active]! } : null;

  return (
    <figure className={cn("relative transition-opacity duration-300", dimmed && "opacity-50")}>
      <div
        ref={ref}
        role="img"
        aria-label={caption}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerMove={(e: PointerEvent) => locate(e.clientX)}
        onPointerLeave={() => setActive(null)}
        className="relative w-full touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        style={{ height }}
      >
        {width > 0 ? (
          <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b28cc" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#3b28cc" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={0} x2={width} y1={padTop + plotH * f} y2={padTop + plotH * f} stroke="#ecebf3" strokeDasharray={f === 1 ? undefined : "3 4"} />
            ))}
            {!empty ? <path d={geo.area} fill={`url(#${gradientId})`} /> : null}
            <motion.path
              d={geo.line}
              fill="none"
              stroke={empty ? "#d9d7e6" : "#3b28cc"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            {tip ? (
              <g>
                <line x1={tip.x} x2={tip.x} y1={padTop} y2={padTop + plotH} stroke="#110f24" strokeOpacity={0.18} />
                <circle cx={tip.x} cy={tip.y} r={5} fill="#3b28cc" stroke="#fff" strokeWidth={2} />
              </g>
            ) : null}
            {ticks.map((i) => (
              <text
                key={i}
                x={geo.xs[i]}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {data[i]!.label}
              </text>
            ))}
          </svg>
        ) : null}

        {empty && width > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-sm text-muted-foreground">No payments in this period yet</div>
        ) : null}

        {tip ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-border bg-white px-3 py-2 shadow-[0_8px_24px_-12px_rgba(17,15,36,0.35)]"
            style={{ left: Math.min(Math.max(tip.x, 70), width - 70), top: Math.max(0, tip.y - 70) }}
          >
            <p className="text-sm font-semibold whitespace-nowrap tabular">{formatValue(tip.point.value)}</p>
            <p className="text-[11px] whitespace-nowrap text-muted-foreground">
              {tip.point.label}
              {formatDetail?.(active!) ? ` · ${formatDetail(active!)}` : ""}
            </p>
          </div>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Tiny trend line for stat cards. Decorative: the card's number carries the value. */
export function Sparkline({ values, height = 44, className }: { values: number[]; height?: number; className?: string }) {
  const gradientId = useId();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { line, area } = useMemo(() => {
    const max = Math.max(...values, 0);
    const yMax = max > 0 ? max * 1.1 : 1;
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    const xs = values.map((_, i) => i * step);
    const ys = values.map((v) => 2 + (height - 4) - (v / yMax) * (height - 4));
    const l = monotonePath(xs, ys);
    return { line: l, area: xs.length ? `${l} L${xs[xs.length - 1]},${height} L0,${height} Z` : "" };
  }, [values, width, height]);
  const flat = values.every((v) => v === 0);

  return (
    <div ref={ref} className={cn("w-full", className)} style={{ height }} aria-hidden="true">
      {width > 0 ? (
        <svg width={width} height={height}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3b28cc" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#3b28cc" stopOpacity="0" />
            </linearGradient>
          </defs>
          {!flat ? <path d={area} fill={`url(#${gradientId})`} /> : null}
          <path d={line} fill="none" stroke={flat ? "#dedce9" : "#3b28cc"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}
