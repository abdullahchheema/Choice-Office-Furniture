import "server-only";

/**
 * Runs a database read and falls back rather than throwing.
 *
 * The storefront should degrade, not 500, when Postgres is unreachable — a
 * paused Supabase project, a rotated password, or (right now) a connection
 * string that has not been filled in yet. The error is logged once on the
 * server so the cause is visible in the terminal, rather than being swallowed.
 */
export async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(
      `[db] ${label} failed — serving fallback. ` +
        `Check DATABASE_URL/DIRECT_URL in .env.local.\n`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

/** True when the database is reachable and the settings row exists. */
export async function isDatabaseReady(): Promise<boolean> {
  const { getSettingsOrNull } = await import("@/lib/queries");
  const settings = await safeQuery("settings probe", getSettingsOrNull, null);
  return settings !== null;
}
