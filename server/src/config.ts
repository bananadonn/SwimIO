export const RACE_CONFIG = {
  FINISH_LINE_M: 100,
  RACE_DURATION_MS: 60_000,
  METERS_PER_SPEED_PER_SECOND: 0.8,
  COUNTDOWN_MS: 3_000,
  TICK_INTERVAL_MS: 50,   // 20 Hz server tick
} as const;

export const ANTI_CHEAT = {
  // Observed max ~7 at max effort; 15 is physically impossible
  MAX_SPEED: 15,
  MAX_NAME_LENGTH: 24,
  MAX_PACKETS_PER_SEC: 15,
} as const;
