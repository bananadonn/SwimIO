import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Leaderboard, type LeaderboardEntry } from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Current user info
  let elo: number | null = null;
  let username: string | null = null;
  if (user) {
    const [{ data: stats }, { data: profile }] = await Promise.all([
      supabase.from("player_stats").select("elo").eq("user_id", user.id).single(),
      supabase.from("profiles").select("username").eq("id", user.id).single(),
    ]);
    elo   = (stats   as { elo: number }   | null)?.elo      ?? null;
    username = (profile as { username: string } | null)?.username ?? null;
  }

  // Leaderboard — top 25 by ELO
  const { data: rawStats } = await supabase
    .from("player_stats")
    .select("user_id, elo, wins, total_races")
    .order("elo", { ascending: false })
    .limit(25) as { data: { user_id: string; elo: number; wins: number; total_races: number }[] | null };

  const topStats = rawStats ?? [];
  const ids = topStats.map(s => s.user_id);

  const { data: rawProfiles } = ids.length > 0
    ? await supabase.from("profiles").select("id, username").in("id", ids) as { data: { id: string; username: string }[] | null }
    : { data: [] as { id: string; username: string }[] };

  const profileMap = Object.fromEntries((rawProfiles ?? []).map(p => [p.id, p.username]));

  const leaderboard: LeaderboardEntry[] = topStats.map((s, i) => ({
    rank:       i + 1,
    userId:     s.user_id,
    username:   profileMap[s.user_id] ?? "Unknown",
    elo:        s.elo,
    wins:       s.wins,
    totalRaces: s.total_races,
  }));

  return (
    <main className="relative flex min-h-screen flex-col bg-base overflow-hidden">

      {/* Auth corner */}
      <div className="absolute top-5 right-5 flex items-center gap-4 z-10">
        {user ? (
          <>
            <Link href="/profile" className="flex items-center gap-2.5 group">
              <span className="text-muted text-sm group-hover:text-text transition-colors duration-150">
                {username ?? user.email?.split("@")[0]}
              </span>
              {elo != null && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-surface border border-surface-2 text-pool font-mono font-bold tabular-nums">
                  {elo}
                </span>
              )}
            </Link>
            <Link
              href="/auth/signout"
              className="text-xs text-muted/40 hover:text-muted transition-colors duration-150"
            >
              sign out
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-sm text-muted hover:text-text transition-colors duration-150">
            Sign in
          </Link>
        )}
      </div>

      {/* Main content — two-column on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-center justify-center gap-10 lg:gap-20 px-6 py-16 lg:py-12 w-full max-w-5xl mx-auto">

        {/* Left — hero + CTAs */}
        <div className="flex flex-col items-center lg:items-start justify-center gap-8 lg:flex-1 w-full">

          <div className="flex flex-col items-center lg:items-start gap-2">
            <h1 className="font-display text-[clamp(4.5rem,16vw,9rem)] leading-[0.82] tracking-tight text-text select-none">
              SWIMIO
            </h1>
            <p className="text-muted text-sm tracking-[0.2em] uppercase font-medium">
              Freestyle racing · No water required
            </p>
          </div>

          <div className="flex flex-col items-stretch w-full max-w-[17rem] gap-2.5">

            {user ? (
              <Link
                href="/calibrate?next=/race&mode=ranked"
                className="group flex items-center justify-between px-6 py-4 bg-pool hover:bg-[#1ABEF5] rounded-xl transition-colors duration-150"
              >
                <span className="font-display text-xl text-base tracking-wide">RANKED RACE</span>
                <span className="text-base/50 group-hover:translate-x-1 transition-transform duration-150 text-sm">→</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="group flex items-center justify-between px-6 py-4 bg-pool hover:bg-[#1ABEF5] rounded-xl transition-colors duration-150"
              >
                <span className="font-display text-xl text-base tracking-wide">RANKED RACE</span>
                <span className="text-base/50 group-hover:translate-x-1 transition-transform duration-150 text-sm">→</span>
              </Link>
            )}

            <Link
              href="/calibrate?next=/race"
              className="group flex items-center justify-between px-6 py-4 bg-surface hover:bg-surface-2 border border-surface-2 hover:border-pool/30 rounded-xl transition-colors duration-150"
            >
              <span className="font-display text-xl text-text tracking-wide">GUEST RACE</span>
              <span className="text-muted group-hover:translate-x-1 transition-transform duration-150 text-sm">→</span>
            </Link>

            <Link
              href="/calibrate"
              className="group flex items-center justify-between px-6 py-3.5 bg-surface/50 hover:bg-surface rounded-xl transition-colors duration-150"
            >
              <span className="font-display text-lg text-muted tracking-wide">SOLO TRAINING</span>
              <span className="text-muted/40 group-hover:translate-x-1 transition-transform duration-150 text-sm">→</span>
            </Link>

          </div>

          {!user && (
            <p className="text-xs text-muted/40 -mt-2">
              <Link href="/login" className="text-pool/70 hover:text-pool transition-colors">Sign in</Link>
              {" "}to track ELO and compete in ranked races
            </p>
          )}

        </div>

        {/* Right — leaderboard */}
        <div className="w-full lg:w-72 shrink-0">
          <Leaderboard entries={leaderboard} currentUserId={user?.id} />
        </div>

      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-pool/20 to-transparent" />
    </main>
  );
}
