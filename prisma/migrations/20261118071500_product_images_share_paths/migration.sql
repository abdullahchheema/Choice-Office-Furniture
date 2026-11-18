-- Two variants of the same product may share one photo, so the
-- (productId, storagePath) uniqueness on product_images is dropped. Uploads
-- always generate fresh paths, so nothing relied on it for correctness.
DROP INDEX "product_images_productId_storagePath_key";
