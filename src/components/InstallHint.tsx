"use client";

import { useSyncExternalStore } from "react";
import { useStored } from "@/lib/useStored";

// A one-time tip for iPhone visitors in Safari: how to put the site on their
// home screen as an app. Hidden once installed or dismissed.
function isIphoneSafari() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ua = nav.userAgent;
  const iOS = /iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  // Chrome, Firefox and others on iOS say so in the user agent.
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && safari && !nav.standalone;
}

const noop = () => () => {};

export function InstallHint({ text }: { text: string }) {
  const show = useSyncExternalStore(noop, isIphoneSafari, () => false);
  const [dismissed, setDismissed] = useStored("install-hint-dismissed");
  if (!show || dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded border border-line bg-surface px-4 py-3 text-sm">
      <p className="flex-1 text-muted">{text}</p>
      <button
        type="button"
        onClick={() => setDismissed("1")}
        aria-label="Dismiss"
        className="text-muted transition-colors hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
