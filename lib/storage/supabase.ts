import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { PutArgs, StorageDriver, StoredObject } from "./types";

/*
 * `import "server-only"` at the top of this file is load-bearing security, not
 * documentation: a stray import of this module from a "use client" component
 * becomes a BUILD error instead of shipping the service-role key — which
 * bypasses row-level security entirely — to the browser.
 *
 * The key also deliberately has no NEXT_PUBLIC_ prefix, so Next will not inline
 * it into client bundles even by accident.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage is not configured. NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseStorage: StorageDriver = {
  name: "supabase",

  async put({ bytes, mimeType, path, cacheControl }: PutArgs): Promise<StoredObject> {
    const { error } = await client()
      .storage.from(BUCKET)
      .upload(path, bytes, {
        contentType: mimeType,
        // Paths are content-unique and never reused, so a long immutable
        // cache is safe.
        cacheControl: cacheControl ?? "31536000",
        upsert: false,
      });

    if (error) throw new Error(`Supabase upload failed for ${path}: ${error.message}`);

    return {
      path,
      publicUrl: supabaseStorage.publicUrl(path),
      bytes: bytes.byteLength,
      mimeType,
    };
  },

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await client().storage.from(BUCKET).remove(paths);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  },

  publicUrl(path: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
    return `${base.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
  },
};
