-- Deleting a product must cascade through its variants' option rows before the
-- attribute/value rows go. RESTRICT fires immediately and broke that order;
-- NO ACTION still refuses to delete an option in use, but is checked at the
-- end of the statement, after every cascade has run.

-- DropForeignKey
ALTER TABLE "variant_options" DROP CONSTRAINT "variant_options_attributeId_fkey";

-- DropForeignKey
ALTER TABLE "variant_options" DROP CONSTRAINT "variant_options_valueId_fkey";

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "product_attributes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "product_attribute_values"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

