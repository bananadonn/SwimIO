"use client";

// Speed values above this are treated as 100% full on the meter
const METER_MAX = 6;

interface Props {
  speed: number;
}

export function SwimMeter({ speed }: Props) {
  const fill = Math.min(speed / METER_MAX, 1);
  const pct = `${(fill * 100).toFixed(0)}%`;

  // Color shifts from blue → cyan → white as speed increases
  const barColor =
    fill > 0.75
      ? "bg-white"
      : fill > 0.4
      ? "bg-cyan-400"
      : "bg-blue-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-500 w-12 shrink-0">SPEED</span>
      <div className="relative flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-75 ${barColor}`}
          style={{ width: pct }}
        />
      </div>
      <span className="text-xs text-neutral-400 w-8 text-right tabular-nums">
        {speed.toFixed(1)}
      </span>
    </div>
  );
}
