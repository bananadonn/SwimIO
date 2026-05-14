"use client";

import type { SwimSpeedResult } from "@/lib/swimSpeed";

interface Props {
  swimSpeed: SwimSpeedResult;
}

const THRESHOLDS = { arc: 0.4, alternation: 0.3, balance: 0.4 } as const;

const METRICS = [
  { key: "arc",         label: "ARC",     hint: "Swing wider" },
  { key: "alternation", label: "RHYTHM",  hint: "Alternate arms" },
  { key: "balance",     label: "BALANCE", hint: "Use both arms" },
] as const;

export function FormFeedback({ swimSpeed }: Props) {
  const values = {
    arc:         swimSpeed.arcRatio,
    alternation: swimSpeed.alternationRatio,
    balance:     swimSpeed.bilateralBalance,
  };

  return (
    <div className="flex flex-col gap-2">
      {METRICS.map(({ key, label, hint }) => {
        const value = values[key];
        const poor  = value < THRESHOLDS[key];
        const pct   = `${Math.min(value * 100, 100).toFixed(1)}%`;

        return (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[10px] font-semibold text-muted tracking-[0.12em] w-14 shrink-0 uppercase">
              {label}
            </span>
            <div className="relative flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{ width: pct, backgroundColor: poor ? "#F59E0B" : "#22C55E" }}
              />
            </div>
            <span className={`text-[11px] w-24 shrink-0 transition-colors duration-150 ${poor ? "text-amber-400" : "invisible"}`}>
              {hint}
            </span>
          </div>
        );
      })}
    </div>
  );
}
