"use client";

interface Props {
  countdown: number | null;
}

export function Countdown({ countdown }: Props) {
  if (countdown === null) return null;

  const label = countdown === 0 ? "GO!" : String(countdown);
  const isGo = countdown === 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-base/60 z-10">
      <span
        key={label}
        className={`font-display select-none leading-none tracking-tight ${
          isGo
            ? "text-[clamp(6rem,20vw,11rem)] text-energy animate-go-slam"
            : "text-[clamp(7rem,22vw,13rem)] text-text animate-slam"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
