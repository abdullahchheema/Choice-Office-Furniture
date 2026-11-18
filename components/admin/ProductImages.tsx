"use client";

import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import {
  deleteProductImage,
  moveProductImage,
  setPrimaryImage,
} from "@/lib/actions/images";

type Image = { id: string; src: string; alt: string; isPrimary: boolean };

/**
 * A photo gallery for one scope: the product's shared gallery
 * (`variantId` omitted) or a single variant's own.
 *
 * The starred image is that scope's primary. A variant that has photos of its
 * own shows only those on the product page; one with none falls back to the
 * shared gallery — so the shared gallery should always hold something sensible.
 */
export function ProductImages({
  productId,
  variantId = null,
  images,
  title = "Photos",
  note = "Re-encoded to WebP and capped at 2000px on upload. The starred image is the one the shop shows first.",
  compact = false,
}: {
  productId: string;
  variantId?: string | null;
  images: Image[];
  title?: string;
  note?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const altId = useId();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!altText.trim()) {
      setError("Describe the image first — it is required for screen readers.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("productId", productId);
      if (variantId) body.set("variantId", variantId);
      body.set("altText", altText.trim());

      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Upload failed");
        return;
      }

      setAltText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      await task();
      router.refresh();
    });

  const body = (
    <>
      {images.length > 0 ? (
        <ul className={`mt-4 grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
          {images.map((image, index) => (
            <li
              key={image.id}
              className="group relative overflow-hidden rounded-md border border-line bg-linen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img src={image.src} alt={image.alt} className="aspect-square w-full object-cover" />

              {image.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-espresso px-2 py-0.5 text-[0.65rem] font-bold text-cream">
                  Primary
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                {index > 0 ? (
                  <button
                    type="button"
                    title="Move earlier"
                    aria-label={`Move ${image.alt} earlier`}
                    disabled={pending}
                    onClick={() => run(() => moveProductImage(image.id, -1))}
                    className="rounded bg-white/90 p-1.5 text-espresso hover:bg-white"
                  >
                    <ArrowLeft size={14} />
                  </button>
                ) : null}
                {index < images.length - 1 ? (
                  <button
                    type="button"
                    title="Move later"
                    aria-label={`Move ${image.alt} later`}
                    disabled={pending}
                    onClick={() => run(() => moveProductImage(image.id, 1))}
                    className="rounded bg-white/90 p-1.5 text-espresso hover:bg-white"
                  >
                    <ArrowRight size={14} />
                  </button>
                ) : null}
                {!image.isPrimary ? (
                  <button
                    type="button"
                    title="Make primary"
                    aria-label={`Make ${image.alt} the primary image`}
                    disabled={pending}
                    onClick={() => run(() => setPrimaryImage(image.id))}
                    className="rounded bg-white/90 p-1.5 text-espresso hover:bg-white"
                  >
                    <Star size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Delete"
                  aria-label={`Delete ${image.alt}`}
                  disabled={pending}
                  onClick={() => run(() => deleteProductImage(image.id))}
                  className="rounded bg-white/90 p-1.5 text-destructive hover:bg-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-text-muted">
          {variantId
            ? "No photos of its own — this variant shows the product's shared photos."
            : "No photos yet."}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor={altId}
            className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
          >
            Describe the photo
          </label>
          <input
            id={altId}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Executive chair in black leather, three-quarter view"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus-visible:border-clay"
          />
        </div>

        <label
          className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-espresso px-5 py-2.5 text-sm font-bold text-espresso transition-colors hover:bg-espresso hover:text-cream ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Upload size={15} aria-hidden="true" />
          {uploading ? "Uploading…" : "Add photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{title}</h4>
        {note ? <p className="mt-1 text-xs text-text-muted">{note}</p> : null}
        {body}
      </div>
    );
  }

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-xs text-text-muted">{note}</p>
      {body}
    </section>
  );
}
