-- Product variants.
--
-- Every product becomes a product-with-variants. Existing products each get one
-- default variant carrying the price, stock, SKU and ledger history they had,
-- so nothing is lost and nothing needs re-entering. Order lines and ledger rows
-- are repointed at that variant before the old product-level columns are
-- dropped. One transaction: it either all applies or none of it does.
BEGIN;

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIABLE');

-- CreateEnum
CREATE TYPE "AttributeDisplay" AS ENUM ('BUTTONS', 'SWATCHES');

-- ── additive column changes (old columns stay until the backfill is done) ──
ALTER TABLE "products"
  ADD COLUMN "minPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'SIMPLE';

ALTER TABLE "product_images" ADD COLUMN "variantId" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN "compareAtPrice" DECIMAL(12,2),
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "variantLabel" TEXT,
  ADD COLUMN "variantOptions" JSONB;

-- Nullable for now; made NOT NULL once every row has been repointed.
ALTER TABLE "inventory_transactions" ADD COLUMN "variantId" TEXT;

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "display" "AttributeDisplay" NOT NULL DEFAULT 'BUTTONS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" VARCHAR(80) NOT NULL,
    "swatchHex" VARCHAR(9),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_options" (
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,

    CONSTRAINT "variant_options_pkey" PRIMARY KEY ("variantId","attributeId")
);

-- CreateTable
CREATE TABLE "product_specifications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "groupName" VARCHAR(60),
    "name" VARCHAR(80) NOT NULL,
    "value" VARCHAR(400) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_spec_templates" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "groupName" VARCHAR(60),
    "name" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_spec_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_attributes_productId_sortOrder_idx" ON "product_attributes"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_productId_name_key" ON "product_attributes"("productId", "name");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_sortOrder_idx" ON "product_attribute_values"("attributeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_attributeId_value_key" ON "product_attribute_values"("attributeId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_productId_isActive_sortOrder_idx" ON "product_variants"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "variant_options_valueId_idx" ON "variant_options"("valueId");

-- CreateIndex
CREATE INDEX "product_specifications_productId_variantId_sortOrder_idx" ON "product_specifications"("productId", "variantId", "sortOrder");

-- CreateIndex
CREATE INDEX "category_spec_templates_categoryId_sortOrder_idx" ON "category_spec_templates"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_spec_templates_categoryId_name_key" ON "category_spec_templates"("categoryId", "name");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- CreateIndex
CREATE INDEX "product_images_variantId_sortOrder_idx" ON "product_images"("variantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "product_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "product_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "product_attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_spec_templates" ADD CONSTRAINT "category_spec_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════ BACKFILL ═══════════════════════════

-- 1. One default variant per existing product, carrying its commercial data.
INSERT INTO "product_variants"
  ("id", "productId", "sku", "price", "compareAtPrice", "stockQuantity",
   "lowStockThreshold", "trackInventory", "isActive", "isDefault", "sortOrder",
   "createdAt", "updatedAt")
SELECT 'cv' || substr(md5(random()::text || p."id"), 1, 24),
       p."id", p."sku", p."price", p."compareAtPrice", p."stockQuantity",
       p."lowStockThreshold", p."trackInventory", true, true, 0,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "products" p;

UPDATE "products" SET "minPrice" = "price";

-- 2. Order lines placed before variants existed point at that default variant.
UPDATE "order_items" oi
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = oi."productId" AND v."isDefault";

-- 3. Ledger history moves to the variant that now owns the stock.
UPDATE "inventory_transactions" t
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = t."productId" AND v."isDefault";

-- 4. The old fixed spec columns become real, editable specification rows.
INSERT INTO "product_specifications" ("id", "productId", "name", "value", "sortOrder")
SELECT 'cs' || substr(md5(random()::text || p."id" || 'm'), 1, 24), p."id", 'Material', p."material", 0
FROM "products" p WHERE p."material" IS NOT NULL AND p."material" <> '';

INSERT INTO "product_specifications" ("id", "productId", "name", "value", "sortOrder")
SELECT 'cs' || substr(md5(random()::text || p."id" || 'd'), 1, 24), p."id", 'Dimensions', p."dimensions", 1
FROM "products" p WHERE p."dimensions" IS NOT NULL AND p."dimensions" <> '';

INSERT INTO "product_specifications" ("id", "productId", "name", "value", "sortOrder")
SELECT 'cs' || substr(md5(random()::text || p."id" || 'w'), 1, 24), p."id", 'Weight', p."weightKg"::text || ' kg', 2
FROM "products" p WHERE p."weightKg" IS NOT NULL;

INSERT INTO "product_specifications" ("id", "productId", "name", "value", "sortOrder")
SELECT 'cs' || substr(md5(random()::text || p."id" || 'y'), 1, 24), p."id", 'Warranty',
       CASE WHEN p."warrantyMonths" % 12 = 0
            THEN (p."warrantyMonths" / 12)::text || CASE WHEN p."warrantyMonths" = 12 THEN ' year' ELSE ' years' END
            ELSE p."warrantyMonths"::text || ' months' END, 3
FROM "products" p WHERE p."warrantyMonths" IS NOT NULL AND p."warrantyMonths" > 0;

INSERT INTO "product_specifications" ("id", "productId", "name", "value", "sortOrder")
SELECT 'cs' || substr(md5(random()::text || p."id" || 'a'), 1, 24), p."id", 'Assembly',
       CASE WHEN p."assemblyRequired" THEN 'Required — we assemble on delivery' ELSE 'Pre-assembled' END, 4
FROM "products" p;

-- 5. Refuse to continue if anything was left dangling.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inventory_transactions" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: inventory_transactions rows without a variant';
  END IF;
  IF EXISTS (SELECT 1 FROM "order_items" WHERE "productId" IS NOT NULL AND "variantId" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: order_items rows without a variant';
  END IF;
  IF (SELECT COUNT(*) FROM "product_variants") <> (SELECT COUNT(*) FROM "products") THEN
    RAISE EXCEPTION 'backfill incomplete: variant count differs from product count';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "product_variants" v
    WHERE v."stockQuantity" <> COALESCE(
      (SELECT SUM(t."quantityDelta") FROM "inventory_transactions" t WHERE t."variantId" = v."id"), 0)
  ) THEN
    RAISE EXCEPTION 'backfill incomplete: variant stock does not match the ledger';
  END IF;
END $$;

-- ═══════════════════════ tighten and drop the old shape ═══════════════════════

ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_productId_fkey";
DROP INDEX "inventory_transactions_orderId_productId_reason_key";
DROP INDEX "inventory_transactions_productId_createdAt_idx";
ALTER TABLE "inventory_transactions" DROP COLUMN "productId";
ALTER TABLE "inventory_transactions" ALTER COLUMN "variantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "inventory_transactions_variantId_createdAt_idx" ON "inventory_transactions"("variantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_orderId_variantId_reason_key" ON "inventory_transactions"("orderId", "variantId", "reason");

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "products_status_categoryId_price_idx";
DROP INDEX "products_status_price_idx";

ALTER TABLE "products"
  DROP COLUMN "assemblyRequired",
  DROP COLUMN "compareAtPrice",
  DROP COLUMN "dimensions",
  DROP COLUMN "lowStockThreshold",
  DROP COLUMN "material",
  DROP COLUMN "price",
  DROP COLUMN "stockQuantity",
  DROP COLUMN "trackInventory",
  DROP COLUMN "warrantyMonths",
  DROP COLUMN "weightKg";

-- CreateIndex
CREATE INDEX "products_status_categoryId_minPrice_idx" ON "products"("status", "categoryId", "minPrice");

-- CreateIndex
CREATE INDEX "products_status_minPrice_idx" ON "products"("status", "minPrice");

COMMIT;
