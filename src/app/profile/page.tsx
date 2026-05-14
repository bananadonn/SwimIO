import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from("profiles").select("username, created_at").eq("id", user.id).single(),
    supabase.from("player_stats").select("elo, wins, losses, total_races, fastest_time_ms").eq("user_id", user.id).single(),
  ]);

  const userElo = (stats as { elo: number } | null)?.elo ?? 0;
  const { count: aboveCount } = await supabase
    .from("player_stats")
    .select("user_id", { count: "exact", head: true })
    .gt("elo", userElo);
  const globalRank = (aboveCount ?? 0) + 1;

  const winRate = stats && stats.total_races > 0
    ? Math.round((stats.wins / stats.total_races) * 100)
    : null;
  const fastestSec = stats?.fastest_time_ms != null
    ? (stats.fastest_time_ms / 1000).toFixed(1)
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-base">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted hover:text-text transition-colors duration-150">← Home</Link>
          <span className="font-display text-sm tracking-widest text-muted">PROFILE</span>
          <div className="w-10" />
        </div>

        {/* Identity card */}
        <div className="bg-surface border border-surface-2 rounded-2xl p-5 flex flex-col gap-1">
          <span className="font-display text-3xl text-text tracking-wide uppercase">
            {profile?.username ?? "—"}
          </span>
          <span className="text-xs text-muted">{user.email}</span>
        </div>

        {/* ELO highlight */}
        <div className="bg-surface border border-pool/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-5xl text-pool tabular-nums">{stats?.elo ?? "—"}</span>
            <span className="text-[10px] tracking-[0.2em] text-muted uppercase">ELO</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-display text-2xl text-energy tabular-nums">#{globalRank}</span>
            <span className="text-[10px] tracking-[0.12em] text-muted uppercase">Global</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Races"     value={stats?.total_races?.toString() ?? "0"} />
          <StatTile label="Wins"      value={stats?.wins?.toString() ?? "0"} />
          <StatTile label="Losses"    value={stats?.losses?.toString() ?? "0"} />
          <StatTile label="Win rate"  value={winRate != null ? `${winRate}%` : "—"} />
          <StatTile label="Best time" value={fastestSec ? `${fastestSec}s` : "—"} colSpan />
        </div>

        {/* Sign out */}
        <Link
          href="/auth/signout"
          className="block w-full text-center rounded-xl bg-surface hover:bg-surface-2 border border-surface-2 px-4 py-3 text-sm font-medium text-muted hover:text-text transition-colors duration-150"
        >
          Sign out
        </Link>

      </div>
    </main>
  );
}

function StatTile({ label, value, colSpan }: { label: string; value: string; colSpan?: boolean }) {
  return (
    <div className={`bg-surface border border-surface-2 rounded-xl p-4 ${colSpan ? "col-span-2" : ""}`}>
      <p className="font-display text-2xl text-text tabular-nums leading-none mb-1">{value}</p>
      <p className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</p>
    </div>
  );
}
