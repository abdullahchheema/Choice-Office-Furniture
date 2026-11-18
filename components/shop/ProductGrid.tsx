import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductDTO } from "@/lib/dto";

/**
 * A plain grid of cards, reusing the original `.product-grid` rules.
 *
 * A Server Component with client leaves inside it: the names, prices and
 * images are in the initial HTML for search engines, and only the wishlist and
 * add-to-cart buttons ship JavaScript.
 */
export function ProductGrid({ products }: { products: ProductDTO[] }) {
  return (
    <ul className="product-grid">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} revealIndex={index} />
      ))}
    </ul>
  );
}
