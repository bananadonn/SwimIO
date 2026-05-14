"use client";

const METER_MAX = 6;

interface Props {
  speed: number;
}

export function SwimMeter({ speed }: Props) {
  const fill = Math.min(speed / METER_MAX, 1);
  const pct = `${(fill * 100).toFixed(1)}%`;

  const barColor =
    fill > 0.75 ? "#F5F7FA" :
    fill > 0.4  ? "#00D4FF" :
    "#00B4F0";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold text-muted tracking-[0.15em] w-12 shrink-0 uppercase">
        Speed
      </span>
      <div className="relative flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{ width: pct, backgroundColor: barColor }}
        />
      </div>
      <span className="text-xs font-mono text-muted tabular-nums w-10 text-right font-bold">
        {speed.toFixed(1)}
      </span>
    </div>
  );
}
