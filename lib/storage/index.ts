import "server-only";

import { localStorageDriver } from "./local";
import { supabaseStorage } from "./supabase";
import type { StorageDriver } from "./types";

export type { StorageDriver, StoredObject } from "./types";

function selectDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "local"
    ? localStorageDriver
    : supabaseStorage;
}

export const storage: StorageDriver = selectDriver();

/**
 * Builds the stored path for an object.
 *
 * The filename is always generated, never taken from the upload. That single
 * decision removes path traversal, encoding issues, Unicode normalisation
 * differences between Windows dev and Linux production, and overwrite
 * collisions — all at once.
 */
export function buildStoragePath(
  scope: "products" | "categories" | "site",
  ownerId: string,
  extension = "webp",
): string {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "");
  const unique = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  return scope === "site"
    ? `site/${unique}.${extension}`
    : `${scope}/${safeOwner}/${unique}.${extension}`;
}

/** Last line of defence before a path reaches a driver. */
export function assertSafeStoragePath(objectPath: string): void {
  if (!/^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|jpeg|png|avif)$/i.test(objectPath)) {
    throw new Error(`Unsafe storage path: ${objectPath}`);
  }
  if (objectPath.includes("..")) {
    throw new Error(`Unsafe storage path: ${objectPath}`);
  }
}
