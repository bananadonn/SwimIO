"use client";

export function ArmWarning() {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-yellow-400/95 text-black text-sm font-semibold px-4 py-2 rounded-full whitespace-nowrap select-none">
      ⚠️ Keep both arms in frame
    </div>
  );
}
