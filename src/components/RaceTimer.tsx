"use client";

import { useEffect, useRef } from "react";
import { RACE_CONFIG } from "@/hooks/useRace";

interface Props {
  elapsedMsRef: React.MutableRefObject<number>;
}

export function RaceTimer({ elapsedMsRef }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;

    function update() {
      const remaining = Math.max(0, RACE_CONFIG.RACE_DURATION_MS - elapsedMsRef.current);
      const secs = Math.ceil(remaining / 1000);

      if (spanRef.current) {
        spanRef.current.textContent = `${secs}s`;
        spanRef.current.className = remaining <= 10_000
          ? "font-mono font-bold tabular-nums text-coral text-xl"
          : "font-mono font-bold tabular-nums text-text text-xl";
      }

      raf = requestAnimationFrame(update);
    }

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [elapsedMsRef]);

  return <span ref={spanRef} className="font-mono font-bold tabular-nums text-text text-xl" />;
}
