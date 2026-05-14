"use client";

import type { RaceResult } from "@/hooks/useRace";

interface Props {
  result: RaceResult;
  onPlayAgain: () => void;
}

export function WinScreen({ result, onPlayAgain }: Props) {
  const { finishTimeMs, finalDistance } = result;

  const sub =
    finishTimeMs !== null ? "You hit the finish line." :
    finalDistance >= 80   ? "So close!" :
    finalDistance >= 50   ? "Halfway there!" :
    "Keep training!";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base/90 z-20 gap-2 animate-victory-in">

      {finishTimeMs !== null ? (
        <>
          <span className="text-[10px] tracking-[0.4em] font-semibold text-energy uppercase mb-1">
            Finish
          </span>
          <div className="font-display leading-none text-text text-[clamp(5rem,18vw,9rem)] tabular-nums">
            {(finishTimeMs / 1000).toFixed(1)}<span className="text-[40%] text-muted">s</span>
          </div>
        </>
      ) : (
        <>
          <span className="text-[10px] tracking-[0.4em] font-semibold text-muted uppercase mb-1">
            Time up
          </span>
          <div className="font-display leading-none text-text text-[clamp(5rem,18vw,9rem)] tabular-nums">
            {finalDistance}<span className="text-[40%] text-muted">m</span>
          </div>
        </>
      )}

      <p className="text-muted text-sm mt-1 mb-6">{sub}</p>

      <button
        onClick={onPlayAgain}
        className="px-8 py-3 rounded-xl bg-pool hover:bg-[#1ABEF5] text-base font-display text-lg tracking-wide transition-colors duration-150"
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
