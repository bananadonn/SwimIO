"use client";

import type { RaceResult } from "@/hooks/useRace";

interface Props {
  result: RaceResult;
  onPlayAgain: () => void;
}

export function WinScreen({ result, onPlayAgain }: Props) {
  const { finishTimeMs, finalDistance } = result;

  const headline = finishTimeMs !== null
    ? `You finished in ${(finishTimeMs / 1000).toFixed(1)}s!`
    : `Time's up — you made it ${finalDistance}m!`;

  const sub = finishTimeMs !== null
    ? "You hit the finish line."
    : finalDistance >= 80
    ? "So close!"
    : finalDistance >= 50
    ? "Halfway there!"
    : "Keep training!";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/70 z-20">
      <p className="text-3xl font-black text-white text-center px-4">{headline}</p>
      <p className="text-neutral-400 text-sm">{sub}</p>
      <button
        onClick={onPlayAgain}
        className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold hover:bg-blue-500 transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
