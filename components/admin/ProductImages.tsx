"use client";

import { Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { deleteProductImage, setPrimaryImage } from "@/lib/actions/images";

type Image = { id: string; src: string; alt: string; isPrimary: boolean };

export function ProductImages({
  productId,
  images,
}: {
  productId: string;
  images: Image[];
}) {
  const router = useRouter();
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

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-extrabold text-ink">Photos</h2>
      <p className="mt-1 text-xs text-text-muted">
        Re-encoded to WebP and capped at 2000px on upload. The starred image is
        the one the shop shows on cards.
      </p>

      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <li
              key={image.id}
              className="group relative overflow-hidden rounded-md border border-line bg-linen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img
                src={image.src}
                alt={image.alt}
                className="aspect-square w-full object-cover"
              />

              {image.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-espresso px-2 py-0.5 text-[0.65rem] font-bold text-cream">
                  Primary
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {!image.isPrimary && (
                  <button
                    type="button"
                    title="Make primary"
                    aria-label={`Make ${image.alt} the primary image`}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setPrimaryImage(image.id);
                        router.refresh();
                      })
                    }
                    className="rounded bg-white/90 p-1.5 text-espresso hover:bg-white"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete"
                  aria-label={`Delete ${image.alt}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteProductImage(image.id);
                      router.refresh();
                    })
                  }
                  className="rounded bg-white/90 p-1.5 text-destructive hover:bg-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor="altText"
            className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
          >
            Describe the photo
          </label>
          <input
            id="altText"
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Executive chair in tan leather, three-quarter view"
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
    </section>
  );
}
