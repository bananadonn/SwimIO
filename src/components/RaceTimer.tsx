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
      const secs = (remaining / 1000).toFixed(1);

      if (spanRef.current) {
        spanRef.current.textContent = `${secs}s`;
        // Red when under 10s
        spanRef.current.className = remaining <= 10_000
          ? "tabular-nums font-mono text-red-400"
          : "tabular-nums font-mono text-neutral-400";
      }

      raf = requestAnimationFrame(update);
    }

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [elapsedMsRef]);

  return <span ref={spanRef} className="tabular-nums font-mono text-neutral-400" />;
}
