/**
 * The catalog — the migration seam.
 *
 * The original script.js built this object by scraping `data-id/name/price`
 * attributes off the rendered DOM. That scraped shape is exactly what the
 * database will return in Phase 3, so the cards become data-driven here with
 * no change to how the cart consumes them, and this file is simply replaced by
 * a Prisma query later.
 *
 * Phase 2 keeps the original products, copy and USD prices deliberately: the
 * point of this phase is to prove the migration is visually identical to the
 * old site, and that diff is only meaningful with identical content. The
 * office-furniture catalog and PKR pricing arrive with the database.
 *
 * `tone`, `objectPosition` and `lift` are hand-tuned per photo. They are
 * carried as data rather than baked into CSS because they become real
 * `Product` columns, so the admin keeps that per-image control.
 */

export type ProductCategory = "living" | "dining" | "bedroom" | "storage";

export type Product = {
  id: string;
  name: string;
  /** Price in whole currency units. */
  price: number;
  /** Filter buckets. A product may sit in more than one. */
  categories: ProductCategory[];
  /** The label shown on the card, which is not always a filter name. */
  displayCategory: string;
  badge?: string;
  image: {
    src: string;
    width: number;
    height: number;
    alt: string;
    /** Hand-tuned crop focus. */
    objectPosition: string;
    /** Brightens and zooms into a dark photo — used by one product. */
    lift?: boolean;
  };
  /** Backdrop behind the photo, visible while it loads and around the edges. */
  tone: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "halden",
    name: "Halden Sofa",
    price: 1890,
    categories: ["living"],
    displayCategory: "Living",
    badge: "New",
    tone: "#E8D9C3",
    image: {
      src: "/assets/images/sofa.jpg",
      width: 1200,
      height: 800,
      alt: "Halden three-seat linen sofa",
      objectPosition: "38% 50%",
    },
  },
  {
    id: "lund",
    name: "Lund Lounge Chair",
    price: 940,
    categories: ["living"],
    displayCategory: "Living",
    tone: "#E3D2B8",
    image: {
      src: "/assets/images/lounge.jpg",
      width: 1200,
      height: 800,
      alt: "Lund oak lounge chair with woven side panels and linen cushions",
      objectPosition: "62% 50%",
    },
  },
  {
    id: "oslo",
    name: "Oslo Dining Table",
    price: 1420,
    categories: ["dining"],
    displayCategory: "Dining",
    badge: "Bestseller",
    tone: "#EBDDC8",
    image: {
      src: "/assets/images/dining.jpg",
      width: 900,
      height: 1350,
      alt: "Oslo solid oak pedestal dining table with spindle-back chairs",
      objectPosition: "70% 70%",
    },
  },
  {
    id: "nara",
    name: "Nara Dining Chair",
    price: 320,
    categories: ["dining"],
    displayCategory: "Dining",
    tone: "#E6D6BF",
    image: {
      src: "/assets/images/dining-chair.jpg",
      width: 900,
      height: 1285,
      alt: "Nara steam-bent wooden dining chair with a hand-woven paper-cord seat",
      objectPosition: "50% 45%",
    },
  },
  {
    id: "ashby",
    name: "Ashby Platform Bed",
    price: 2260,
    categories: ["bedroom"],
    displayCategory: "Bedroom",
    tone: "#E2D0B6",
    image: {
      src: "/assets/images/bed.jpg",
      width: 1200,
      height: 800,
      alt: "Ashby platform bed with an oak headboard and soft white bedding",
      objectPosition: "30% 60%",
    },
  },
  {
    id: "vale",
    name: "Vale Bedside Table",
    price: 380,
    categories: ["bedroom"],
    displayCategory: "Bedroom",
    tone: "#EADBC5",
    image: {
      src: "/assets/images/nightstand.jpg",
      width: 1200,
      height: 1800,
      alt: "Vale solid wood bedside table with drawers beside a wooden bed",
      objectPosition: "88% 82%",
      lift: true,
    },
  },
  {
    id: "sture",
    name: "Sture Open Shelf",
    price: 1120,
    categories: ["storage"],
    displayCategory: "Storage",
    tone: "#EDE0CB",
    image: {
      src: "/assets/images/shelf.jpg",
      width: 1200,
      height: 800,
      alt: "Sture modular birch wall shelving with floating cabinets",
      objectPosition: "28% 45%",
    },
  },
  {
    id: "aria",
    name: "Aria Table Lamp",
    price: 260,
    // The only product in two buckets, and its card label ("Light") matches
    // neither — both are intentional and preserved from the original.
    categories: ["living", "storage"],
    displayCategory: "Light",
    badge: "Low stock",
    tone: "#E4D3BA",
    image: {
      src: "/assets/images/lamp.jpg",
      width: 900,
      height: 1350,
      alt: "Aria ceramic table lamp glowing warmly on a wooden stool",
      objectPosition: "70% 65%",
    },
  },
];

export const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export const FILTERS: { value: "all" | ProductCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "living", label: "Living" },
  { value: "dining", label: "Dining" },
  { value: "bedroom", label: "Bedroom" },
  { value: "storage", label: "Storage" },
];

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return formatter.format(value);
}
