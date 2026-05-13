"use client";

interface Props {
  countdown: number | null;
}

export function Countdown({ countdown }: Props) {
  if (countdown === null) return null;

  const label = countdown === 0 ? "GO!" : String(countdown);
  const isGo = countdown === 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
      <span
        key={label}
        className={`text-8xl font-black tracking-tight select-none animate-ping-once ${
          isGo ? "text-green-400" : "text-white"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
