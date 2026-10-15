"use client";

import { useEffect, useState } from "react";

/** "Updated 8s ago", ticking. */
export function Updated({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  return <span className="tabular-nums">Updated {s < 60 ? `${s}s` : `${Math.round(s / 60)}m`} ago</span>;
}
