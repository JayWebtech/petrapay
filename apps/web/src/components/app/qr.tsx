"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

export function QrCode({ value, size = 184, className, center }: { value: string; size?: number; className?: string; center?: string }) {
  return (
    <div className={cn("relative inline-flex rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5", className)}>
      <QRCodeSVG value={value} size={size} level="M" marginSize={0} bgColor="#ffffff" fgColor="#111111" />
      {center ? (
        <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg bg-white text-[10px] font-bold text-black ring-4 ring-white">
          {center}
        </span>
      ) : null}
    </div>
  );
}
