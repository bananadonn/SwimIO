"use client";

import { useState } from "react";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  wins: number;
  totalRaces: number;
};

const RANK_COLORS: Record<number, string> = {
  1: "text-energy",
  2: "text-[#C0C0C0]",
  3: "text-[#CD7F32]",
};

export function Leaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, 10);
  const hasMore = entries.length > 10;

  return (
    <div className="bg-surface border border-surface-2 rounded-2xl overflow-hidden flex flex-col">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-surface-2 flex items-center justify-between shrink-0">
        <span className="font-display text-sm tracking-[0.2em] text-muted">LEADERBOARD</span>
        <span className="text-[10px] tracking-[0.15em] text-muted/40 uppercase">ELO</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-2 flex-1">
        {visible.map((entry) => {
          const isMe = entry.userId === currentUserId;
          const rankColor = RANK_COLORS[entry.rank] ?? "text-muted/30";

          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                isMe
                  ? "bg-pool/[0.06] border-l-2 border-l-pool"
                  : "border-l-2 border-l-transparent"
              }`}
            >
              {/* Rank */}
              <span className={`font-display text-base w-6 shrink-0 tabular-nums leading-none ${rankColor}`}>
                {entry.rank}
              </span>

              {/* Username */}
              <span className={`font-display text-sm tracking-wide flex-1 truncate leading-none ${
                isMe ? "text-pool" : "text-text"
              }`}>
                {entry.username.toUpperCase()}
                {isMe && (
                  <span className="text-[9px] text-pool/50 ml-1.5 font-sans normal-case tracking-normal font-medium">
                    you
                  </span>
                )}
              </span>

              {/* Stats */}
              <div className="flex items-center gap-3 shrink-0">
                {entry.totalRaces > 0 && (
                  <span className="text-[10px] text-muted/40 tabular-nums hidden sm:block">
                    {entry.wins}W
                  </span>
                )}
                <span className={`font-mono font-bold text-sm tabular-nums ${
                  isMe ? "text-pool" : "text-text"
                }`}>
                  {entry.elo}
                </span>
              </div>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="px-5 py-10 text-center text-muted/30 text-sm">
            No ranked matches yet. Be the first.
          </div>
        )}
      </div>

      {/* Expand / collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="border-t border-surface-2 w-full py-2.5 text-[10px] text-muted/40 hover:text-muted tracking-[0.2em] uppercase transition-colors duration-150"
        >
          {expanded ? "Show less ↑" : "Show top 25 ↓"}
        </button>
      )}
    </div>
  );
}
