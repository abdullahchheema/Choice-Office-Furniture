import "server-only";

import { hash, verify } from "@node-rs/argon2";

/*
 * argon2id, via @node-rs/argon2 — napi prebuilds, so no node-gyp toolchain is
 * needed on Windows or on the Linux deploy host.
 *
 * Parameters are OWASP's interactive-login baseline: 19 MiB of memory, two
 * passes, one lane. Memory cost is what makes GPU cracking expensive, so it is
 * the number to raise first if this ever needs hardening.
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/**
 * A real argon2id hash of a random string, used to equalise timing when an
 * email does not exist. Without it, "no such user" returns measurably faster
 * than "wrong password", which lets an attacker enumerate valid accounts.
 */
let dummyHash: string | null = null;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // A malformed hash in the database must read as "wrong password",
    // never as an exception that leaks a different response.
    return false;
  }
}

/** Burn the same work as a real verify, so a missing account costs the same. */
export async function equalisePasswordTiming(plain: string): Promise<void> {
  if (!dummyHash) {
    dummyHash = await hash(
      `nonexistent-account-${crypto.randomUUID()}`,
      OPTIONS,
    );
  }
  await verifyPassword(dummyHash, plain);
}
