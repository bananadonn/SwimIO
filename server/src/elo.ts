const K_HIGH = 10;   // elo >= 2000
const K_MID  = 20;   // elo >= 1400
const K_LOW  = 40;   // elo < 1400
const K_CALIB = 60;  // first 5 games

function kFactor(elo: number, gamesPlayed: number): number {
  if (gamesPlayed < 5) return K_CALIB;
  if (elo >= 2000) return K_HIGH;
  if (elo >= 1400) return K_MID;
  return K_LOW;
}

export function calcEloDelta(
  winnerElo: number,
  loserElo: number,
  winnerGames: number,
  loserGames: number,
): number {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const k = Math.max(kFactor(winnerElo, winnerGames), kFactor(loserElo, loserGames));
  return Math.max(1, Math.round(k * (1 - expected)));
}
