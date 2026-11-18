-- Reverts the previous migration. NO ACTION did not fix product deletion: the
-- cascades run as separate statements, each checked on its own, so the order
-- problem remained. The real fix is in the application (deleteProduct removes
-- variants before the product). RESTRICT is restored as the clearer statement
-- of intent: an option in use cannot be deleted.

-- DropForeignKey
ALTER TABLE "variant_options" DROP CONSTRAINT "variant_options_attributeId_fkey";

-- DropForeignKey
ALTER TABLE "variant_options" DROP CONSTRAINT "variant_options_valueId_fkey";

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "product_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "product_attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

