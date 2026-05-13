"use client";

import { useEffect, useRef } from "react";
import { RACE_CONFIG } from "@/hooks/useRace";

interface Props {
  distanceRef: React.MutableRefObject<number>;
}

export function ProgressBar({ distanceRef }: Props) {
  const trackFillRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  // Own rAF loop — reads the ref directly, no React state involved
  useEffect(() => {
    let raf: number;

    function update() {
      const dist = distanceRef.current;
      const pct = Math.min(dist / RACE_CONFIG.FINISH_LINE_M, 1) * 100;
      const pctStr = `${pct.toFixed(2)}%`;

      if (trackFillRef.current) trackFillRef.current.style.width = pctStr;
      if (dotRef.current) dotRef.current.style.left = pctStr;
      if (labelRef.current) labelRef.current.textContent = `${dist.toFixed(1)}m`;

      raf = requestAnimationFrame(update);
    }

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [distanceRef]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-lg select-none">🏊</span>

        {/* Track */}
        <div className="relative flex-1 h-[2px] bg-neutral-700">
          {/* Filled portion */}
          <div
            ref={trackFillRef}
            className="absolute inset-y-0 left-0 bg-cyan-500"
            style={{ width: "0%" }}
          />
          {/* Dot marker */}
          <div
            ref={dotRef}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-cyan-400"
            style={{ left: "0%" }}
          />
        </div>

        <span className="text-xs text-neutral-400 shrink-0">Finish</span>
      </div>

      <div className="flex justify-between text-xs text-neutral-500 px-6">
        <span ref={labelRef} className="tabular-nums">0.0m</span>
        <span>{RACE_CONFIG.FINISH_LINE_M}m</span>
      </div>
    </div>
  );
}
