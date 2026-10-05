"use client";

import { useState } from "react";
import type { Day } from "./page";

const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// One bar per day. Hover or tap a bar for that day's numbers.
export function DailyChart({ daily }: { daily: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.views));
  const shown = active === null ? null : daily[active];

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-sm tabular-nums text-muted">
        {shown
          ? `${dayLabel.format(new Date(shown.day))}: ${shown.views} views, ${shown.visitors} visitors`
          : `Busiest day: ${Math.max(0, ...daily.map((d) => d.views))} views`}
      </p>
      <div
        className="flex h-32 items-end gap-0.5 border-b border-line"
        onMouseLeave={() => setActive(null)}
      >
        {daily.map((d, i) => (
          <button
            key={d.day}
            type="button"
            aria-label={`${dayLabel.format(new Date(d.day))}: ${d.views} views`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="flex h-full flex-1 items-end"
          >
            <span
              className={`w-full rounded-t ${active === i ? "bg-foreground" : "bg-accent"}`}
              style={{ height: d.views ? `${Math.max(3, (d.views / max) * 100)}%` : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted">
        <span>{daily[0] && dayLabel.format(new Date(daily[0].day))}</span>
        <span>{daily.at(-1) && dayLabel.format(new Date(daily.at(-1)!.day))}</span>
      </div>
    </div>
  );
}
