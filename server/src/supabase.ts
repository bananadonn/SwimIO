import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

// JWKS fetched once and cached in memory; re-fetched automatically on unknown kid
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!_jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) return null;
    _jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return _jwks;
}

export interface VerifiedUser {
  sub: string;
  email?: string;
}

export async function verifySupabaseJwt(token: string): Promise<VerifiedUser | null> {
  const jwks = getJwks();
  if (!jwks) return null;
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, email: payload.email as string | undefined };
  } catch {
    return null;
  }
}

export async function fetchPlayerStats(userId: string): Promise<{
  elo: number;
  gamesForCalibration: number;
  username: string;
} | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const [statsResult, profileResult] = await Promise.all([
    db.from("player_stats").select("elo, games_for_calibration").eq("user_id", userId).single(),
    db.from("profiles").select("username").eq("id", userId).single(),
  ]);

  // PGRST116 = no rows found — user existed before the trigger was set up
  const missingProfile = profileResult.error?.code === "PGRST116";
  const missingStats   = statsResult.error?.code   === "PGRST116";

  if (missingProfile || missingStats) {
    console.log(`[supabase] backfilling missing profile/stats for ${userId}`);
    const { data: authData } = await db.auth.admin.getUserById(userId);
    if (!authData?.user) {
      console.error("[supabase] could not fetch auth user for backfill");
      return null;
    }
    const username =
      (authData.user.user_metadata?.username as string | undefined) ??
      authData.user.email?.split("@")[0] ??
      `player_${userId.slice(0, 8)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = db as any;
    if (missingProfile) {
      const { error: pe } = await anyDb.from("profiles").insert({ id: userId, username });
      if (pe) console.error("[supabase] profile insert error:", pe);
    }
    if (missingStats) {
      const { error: se } = await anyDb.from("player_stats").insert({ user_id: userId });
      if (se) console.error("[supabase] player_stats insert error:", se);
    }

    // Retry after backfill
    const [s2, p2] = await Promise.all([
      db.from("player_stats").select("elo, games_for_calibration").eq("user_id", userId).single(),
      db.from("profiles").select("username").eq("id", userId).single(),
    ]);
    if (s2.error || p2.error) {
      console.error("[supabase] retry after backfill failed:", s2.error, p2.error);
      return null;
    }
    const stats   = s2.data as { elo: number; games_for_calibration: number };
    const profile = p2.data as { username: string };
    return { elo: stats.elo, gamesForCalibration: stats.games_for_calibration, username: profile.username };
  }

  if (statsResult.error || profileResult.error) {
    console.error("[supabase] fetchPlayerStats error:", statsResult.error, profileResult.error);
    return null;
  }

  const stats   = statsResult.data   as { elo: number; games_for_calibration: number };
  const profile = profileResult.data as { username: string };
  return { elo: stats.elo, gamesForCalibration: stats.games_for_calibration, username: profile.username };
}

export async function recordRankedMatch(params: {
  winnerId: string;
  loserId: string;
  winnerEloBefore: number;
  loserEloBefore: number;
  eloDelta: number;
  winnerDistanceM: number;
  loserDistanceM: number;
  raceDurationMs: number;
}): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.rpc as any)("record_ranked_match", {
    p_winner_id: params.winnerId,
    p_loser_id: params.loserId,
    p_winner_elo_before: params.winnerEloBefore,
    p_loser_elo_before: params.loserEloBefore,
    p_elo_delta: params.eloDelta,
    p_winner_distance_m: params.winnerDistanceM,
    p_loser_distance_m: params.loserDistanceM,
    p_race_duration_ms: params.raceDurationMs,
  });

  if (error) console.error("record_ranked_match failed:", error);
}
