interface Props {
  myDistance: number;
  opponentDistance: number;
  myName: string;
  opponentName: string;
  finishLine?: number;
}

const FINISH_LINE = 100;

export function MultiProgressBar({
  myDistance,
  opponentDistance,
  myName,
  opponentName,
  finishLine = FINISH_LINE,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <Lane name={myName} distance={myDistance} finishLine={finishLine} color="#00B4F0" />
      <Lane name={opponentName} distance={opponentDistance} finishLine={finishLine} color="#FF4D4D" />
    </div>
  );
}

function Lane({
  name,
  distance,
  finishLine,
  color,
}: {
  name: string;
  distance: number;
  finishLine: number;
  color: string;
}) {
  const pct = Math.min((distance / finishLine) * 100, 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className="font-display text-lg leading-none tracking-wide text-text uppercase truncate max-w-[60%]"
        >
          {name}
        </span>
        <span
          className="font-mono text-xl font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {distance.toFixed(1)}<span className="text-sm text-muted font-normal ml-0.5">m</span>
        </span>
      </div>

      <div className="relative h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {/* Finish line tick */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-muted/30" />
      </div>
    </div>
  );
}
