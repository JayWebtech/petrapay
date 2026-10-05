"use client";

import { Checkbox } from "@/components/motion/checkbox";
import { EVENT_INFO, WEBHOOK_EVENT_TYPES } from "./meta";

/** Choose "all events" or specific ones. Value is ["*"] or a list of event types. */
export function EventPicker({ value, onChange }: { value: string[]; onChange: (events: string[]) => void }) {
  const all = value.includes("*");
  const toggle = (type: string, on: boolean) => {
    const next = new Set(all ? WEBHOOK_EVENT_TYPES : value);
    if (on) next.add(type);
    else next.delete(type);
    onChange(next.size === WEBHOOK_EVENT_TYPES.length ? ["*"] : [...next]);
  };
  return (
    <div className="space-y-2">
      <Checkbox checked={all} onCheckedChange={(on) => onChange(on ? ["*"] : [])} label="All events (including new ones we add)" />
      <div className="space-y-2 border-l border-border pl-4">
        {WEBHOOK_EVENT_TYPES.map((type) => (
          <div key={type}>
            <Checkbox checked={all || value.includes(type)} onCheckedChange={(on) => toggle(type, on)} label={type} className="font-mono text-[13px]" />
            <p className="mt-0.5 pl-8 text-xs text-muted-foreground">{EVENT_INFO[type]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
