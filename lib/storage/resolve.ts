import "server-only";

import { storage } from "@/lib/storage";

/**
 * Turns a stored path into something an `<img src>` can use.
 *
 * Two kinds of path coexist on purpose:
 *   - Paths beginning with "/" are files committed to `public/` — the
 *     decorative hero, craft and showroom art, and the seeded catalog. They
 *     are served by Next directly and never belonged in object storage.
 *   - Everything else is an uploaded object key, resolved through the current
 *     storage driver.
 *
 * This is the only place that distinction is made, which is what lets the
 * database hold keys rather than URLs.
 */
export function resolveImageSrc(storagePath: string): string {
  if (storagePath.startsWith("/") || storagePath.startsWith("http")) {
    return storagePath;
  }
  return storage.publicUrl(storagePath);
}
