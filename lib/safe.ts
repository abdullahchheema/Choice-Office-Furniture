import "server-only";

/**
 * Runs a database read and falls back rather than throwing.
 *
 * The storefront should degrade, not 500, when Postgres is unreachable — a
 * paused Supabase project, a rotated password, or (right now) a connection
 * string that has not been filled in yet. The error is logged once on the
 * server so the cause is visible in the terminal, rather than being swallowed.
 */
/*
 * Back-off after a failure.
 *
 * Without this, every section of every render retries a database that is known
 * to be down. Against Supabase with a wrong password that is enough to trip
 * its own protection — "(ECIRCUITBREAKER) too many authentication failures,
 * new connections are temporarily blocked" — which then locks out the correct
 * password too. One attempt per cooldown is enough to notice recovery.
 */
const COOLDOWN_MS = 15_000;
let failingUntil = 0;
let loggedThisCooldown = false;

export async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (Date.now() < failingUntil) return fallback;

  try {
    const result = await run();
    failingUntil = 0;
    loggedThisCooldown = false;
    return result;
  } catch (error) {
    failingUntil = Date.now() + COOLDOWN_MS;
    // One line per cooldown, not one per section per render.
    if (!loggedThisCooldown) {
      loggedThisCooldown = true;
      console.error(
        `[db] ${label} failed — serving fallback, pausing queries for ${
          COOLDOWN_MS / 1000
        }s. Check DATABASE_URL/DIRECT_URL in .env.local.\n`,
        error instanceof Error ? error.message : error,
      );
    }
    return fallback;
  }
}

/** True when the database is reachable and the settings row exists. */
export async function isDatabaseReady(): Promise<boolean> {
  const { getSettingsOrNull } = await import("@/lib/queries");
  const settings = await safeQuery("settings probe", getSettingsOrNull, null);
  return settings !== null;
}
