"use client";

import { useEffect, useRef } from "react";
import { RACE_CONFIG } from "@/hooks/useRace";

interface Props {
  distanceRef: React.MutableRefObject<number>;
}

export function ProgressBar({ distanceRef }: Props) {
  const trackFillRef = useRef<HTMLDivElement>(null);
  const dotRef       = useRef<HTMLDivElement>(null);
  const labelRef     = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;

    function update() {
      const dist = distanceRef.current;
      const pct  = Math.min(dist / RACE_CONFIG.FINISH_LINE_M, 1) * 100;
      const pctStr = `${pct.toFixed(2)}%`;

      if (trackFillRef.current) trackFillRef.current.style.width = pctStr;
      if (dotRef.current)       dotRef.current.style.left        = pctStr;
      if (labelRef.current)     labelRef.current.textContent     = `${dist.toFixed(1)}m`;

      raf = requestAnimationFrame(update);
    }

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [distanceRef]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Swimmer silhouette */}
        <span className="text-sm select-none text-pool">▶</span>

        {/* Track */}
        <div className="relative flex-1 h-px bg-surface-3">
          <div
            ref={trackFillRef}
            className="absolute inset-y-0 left-0 bg-pool"
            style={{ width: "0%" }}
          />
          {/* Dot */}
          <div
            ref={dotRef}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-text border-2 border-pool shadow-[0_0_6px_rgba(0,180,240,0.6)]"
            style={{ left: "0%" }}
          />
        </div>

        {/* Finish */}
        <div className="flex flex-col items-center gap-0">
          <div className="w-px h-3 bg-energy" />
          <span className="text-[9px] text-energy tracking-widest font-semibold uppercase">100m</span>
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-muted px-4">
        <span ref={labelRef} className="tabular-nums font-mono font-bold text-text">0.0m</span>
        <span className="text-muted/50">{RACE_CONFIG.FINISH_LINE_M}m</span>
      </div>
    </div>
  );
}
