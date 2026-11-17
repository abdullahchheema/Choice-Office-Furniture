import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PutArgs, StorageDriver, StoredObject } from "./types";

const ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Filesystem driver for offline development and tests.
 *
 * Not for production on a serverless host, where the filesystem is ephemeral
 * and per-instance. It exists so the upload pipeline can be exercised without
 * Supabase credentials.
 */
export const localStorageDriver: StorageDriver = {
  name: "local",

  async put({ bytes, mimeType, path: objectPath }: PutArgs): Promise<StoredObject> {
    const target = path.join(ROOT, objectPath);

    // Defence in depth: the caller already validates the shape of the path,
    // but confirm the resolved target really is inside the uploads root.
    if (!target.startsWith(ROOT)) {
      throw new Error(`Refusing to write outside the uploads directory: ${objectPath}`);
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);

    return {
      path: objectPath,
      publicUrl: localStorageDriver.publicUrl(objectPath),
      bytes: bytes.byteLength,
      mimeType,
    };
  },

  async remove(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (objectPath) => {
        const target = path.join(ROOT, objectPath);
        if (!target.startsWith(ROOT)) return;
        await rm(target, { force: true });
      }),
    );
  },

  publicUrl(objectPath: string): string {
    return `/uploads/${objectPath}`;
  },
};
