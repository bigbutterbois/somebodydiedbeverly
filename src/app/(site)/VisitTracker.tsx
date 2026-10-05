"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordView } from "./actions";

// Logs each page view once it's actually shown (not when a link prefetches).
// The site layout leaves it out for the owner.
export function VisitTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    // Only the first page of a visit has an outside referrer.
    const referrer = last.current === null ? document.referrer : "";
    last.current = pathname;
    recordView(pathname, referrer).catch(() => {});
  }, [pathname]);

  return null;
}
