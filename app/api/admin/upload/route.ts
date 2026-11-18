import { fileTypeFromBuffer } from "file-type";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { assertSafeStoragePath, buildStoragePath, storage } from "@/lib/storage";
import { resolveImageSrc } from "@/lib/storage/resolve";

/*
 * Node runtime: Buffer, sharp and Prisma are all unavailable on the Edge.
 *
 * A route handler rather than a Server Action because actions buffer the
 * entire request body before your code runs; here the size can be rejected
 * before reading it all.
 */
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/*
 * image/svg+xml is deliberately absent. An SVG is a document that can carry
 * script, and served from our own origin that is stored XSS.
 */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest) {
  // Its own entry point, so its own authorization check.
  const admin = await requireAdmin();

  // Route handlers do not get Next's automatic Server Action origin check.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  await enforceRateLimit({
    route: "admin-upload",
    identifier: await clientIp(),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });

  const form = await request.formData();
  const file = form.get("file");
  const productId = form.get("productId");
  const altText = String(form.get("altText") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Missing product" }, { status: 400 });
  }
  if (!altText) {
    // Required, not optional: every image on the storefront has alt text and
    // that standard should be enforced rather than hoped for.
    return NextResponse.json(
      { error: "Describe the image for screen readers" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image is too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  /*
   * Sniff the magic bytes. `file.type` is attacker-controlled and the
   * extension is cosmetic, so neither is evidence of anything — this is what
   * catches a .jpg that is really an SVG.
   */
  const sniffed = await fileTypeFromBuffer(input);
  if (!sniffed || !ALLOWED.has(sniffed.mime)) {
    return NextResponse.json(
      { error: "That file is not a JPEG, PNG, WebP or AVIF image" },
      { status: 415 },
    );
  }

  let output: Buffer;
  let width: number | undefined;
  let height: number | undefined;

  try {
    /*
     * Re-encoding is the real sanitiser: whatever was embedded in the original
     * does not survive decode-and-re-encode, and everything lands as WebP so
     * the stored set is uniform. limitInputPixels stops decompression bombs;
     * rotate() applies and then strips EXIF orientation.
     */
    const result = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    output = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    return NextResponse.json(
      { error: "That image could not be processed" },
      { status: 422 },
    );
  }

  // Generated filename, never the uploaded one — removes path traversal,
  // encoding quirks and overwrite collisions in one move.
  const path = buildStoragePath("products", product.id, "webp");
  assertSafeStoragePath(path);

  let stored;
  try {
    stored = await storage.put({ bytes: output, mimeType: "image/webp", path });
  } catch (error) {
    console.error("[admin] upload failed", error);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 502 });
  }

  const existing = await prisma.productImage.count({ where: { productId } });

  const image = await prisma.productImage.create({
    data: {
      productId,
      // The KEY, never the URL — resolving happens on read in lib/dto.ts, so
      // changing bucket or provider stays a config change.
      storagePath: stored.path,
      altText,
      width,
      height,
      bytes: output.byteLength,
      mimeType: "image/webp",
      sortOrder: existing,
      isPrimary: existing === 0,
    },
  });

  console.info(`[admin] ${admin.email} uploaded image ${image.id} for ${productId}`);

  return NextResponse.json({
    id: image.id,
    // The key is what is stored; the URL is what the browser needs.
    src: resolveImageSrc(image.storagePath),
    alt: image.altText,
    isPrimary: image.isPrimary,
  });
}
