"use client";

import { Bungee, Rubik } from "next/font/google";
import { useEffect, useRef } from "react";
import { mountRoguePeon } from "./game.js";
import "./rogue-peon.css";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee" });
const rubik = Rubik({ weight: ["400", "500", "700", "800"], subsets: ["latin"], variable: "--font-rubik" });

// The game is plain DOM (game.js) so it can also run in a test page and in the balance simulations.
// This component only gives it a full-width box below the nav and cleans up on the way out.
export function RoguePeon({ dev }: { dev: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const game = mountRoguePeon(ref.current!, { dev });
    return () => game.destroy();
  }, [dev]);
  return (
    <div className="relative ml-[calc(50%-50vw)] min-h-[540px] w-screen flex-1">
      {/* Inline position: the game's own .peon rule (position: relative) would beat a Tailwind class. */}
      <div ref={ref} className={`${bungee.variable} ${rubik.variable}`} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
