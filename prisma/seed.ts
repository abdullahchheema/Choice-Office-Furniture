/**
 * Seed — categories, settings, the first admin, homepage content and a
 * starter office catalog.
 *
 * Idempotent: every write is an upsert keyed on a natural unique column, so
 * re-running updates rather than duplicating. Safe to run after a schema
 * change or against a half-populated database.
 *
 * Run with: npm run db:seed
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type InventoryReason } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

/*
 * The seed talks to the DIRECT connection, like migrations do — it runs as a
 * one-off script, not as the long-lived app, so there is nothing for the
 * pooler to pool.
 */
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set — see .env.example");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const IMG = "/assets/images/office";

// ───────────────────────────── categories ─────────────────────────────

const CATEGORIES = [
  { slug: "executive-chairs", name: "Executive Chairs", sortOrder: 1, showOnHomepage: true, toneHex: "#E6D5BD",
    description: "High-back leather seating for directors' offices and boardrooms.",
    image: `${IMG}/chair-executive.jpg` },
  { slug: "ergonomic-chairs", name: "Ergonomic Chairs", sortOrder: 2, showOnHomepage: true, toneHex: "#EADCC6",
    description: "Adjustable support built for eight-hour days.",
    image: `${IMG}/chair-mesh.jpg` },
  { slug: "mesh-chairs", name: "Mesh Chairs", sortOrder: 3, toneHex: "#E3D2B8",
    description: "Breathable backs that stay cool through a Karachi summer." },
  { slug: "manager-chairs", name: "Manager Chairs", sortOrder: 4, toneHex: "#E8D9C3",
    description: "Mid-back chairs for everyday management work." },
  { slug: "visitor-chairs", name: "Visitor Chairs", sortOrder: 5, toneHex: "#EFE3CF",
    description: "Guest and meeting seating that stacks and stores." },
  { slug: "gaming-chairs", name: "Gaming Chairs", sortOrder: 6, toneHex: "#E2D0B6", isActive: false,
    description: "Racing-style seating with full recline." },
  { slug: "office-desks", name: "Office Desks", sortOrder: 7, showOnHomepage: true, toneHex: "#EBDDC8",
    description: "Solid-top desks, fixed height and sit-stand.",
    image: `${IMG}/desk-standing.jpg` },
  { slug: "office-tables", name: "Office Tables", sortOrder: 8, toneHex: "#E6D6BF",
    description: "Meeting, training and breakout tables." },
  { slug: "conference-tables", name: "Conference Tables", sortOrder: 9, toneHex: "#EADBC5",
    description: "Boardroom tables from six to twenty seats." },
  { slug: "office-storage", name: "Office Storage", sortOrder: 10, showOnHomepage: true, toneHex: "#EDE0CB",
    description: "Shelving, pedestals and filing that keeps a floor tidy.",
    image: `${IMG}/storage-shelving.jpg` },
  { slug: "office-accessories", name: "Office Accessories", sortOrder: 11, toneHex: "#E4D3BA",
    description: "Monitor arms, lighting and desktop organisation." },
  { slug: "other-equipment", name: "Other Equipment", sortOrder: 12, toneHex: "#E1CFB4",
    description: "Partitions, whiteboards and everything else a floor needs." },
] as const;

// ─────────────────────────────── products ───────────────────────────────

type SeedProduct = {
  slug: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  shortDescription: string;
  description: string;
  stock: number;
  featured?: boolean;
  bestseller?: boolean;
  badge?: string;
  tone: string;
  image: string;
  width: number;
  height: number;
  alt: string;
  objectPosition: string;
  material?: string;
  dimensions?: string;
  warrantyMonths?: number;
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "meridian-executive-chair", sku: "CH-EXE-001", name: "Meridian Executive Chair",
    category: "executive-chairs", price: 48500, compareAtPrice: 56000, stock: 14,
    featured: true, bestseller: true, badge: "Bestseller", tone: "#E8D9C3",
    image: `${IMG}/chair-executive.jpg`, width: 1400, height: 1750, objectPosition: "35% 45%",
    alt: "Meridian executive chair in tan leather beside a maple desk",
    shortDescription: "Full-grain tan leather, high back, polished aluminium base.",
    description:
      "A directors' chair built around a moulded foam shell and full-grain leather that softens with use. The synchronised tilt locks in four positions, and the polished aluminium base carries a 150 kg rating.",
    material: "Full-grain leather, aluminium", dimensions: "W 68 × D 72 × H 112–122 cm", warrantyMonths: 60,
  },
  {
    slug: "atlas-highback-executive-chair", sku: "CH-EXE-002", name: "Atlas High-Back Executive Chair",
    category: "executive-chairs", price: 42000, stock: 9, featured: true, tone: "#E3D2B8",
    image: `${IMG}/chair-manager.jpg`, width: 1400, height: 1867, objectPosition: "22% 55%",
    alt: "Atlas high-back executive chair in grey leather at a white desk",
    shortDescription: "Soft grey leather with a chrome five-star base.",
    description:
      "A quieter take on the executive chair: slim arms, a lower profile back and a chrome base that suits lighter interiors. Gas-lift height adjustment and a weight-tensioned recline.",
    material: "Bonded leather, chrome", dimensions: "W 64 × D 68 × H 108–118 cm", warrantyMonths: 36,
  },
  {
    slug: "flux-ergonomic-mesh-chair", sku: "CH-ERG-001", name: "Flux Ergonomic Mesh Chair",
    category: "ergonomic-chairs", price: 32500, compareAtPrice: 38000, stock: 23,
    featured: true, bestseller: true, badge: "New", tone: "#EADCC6",
    image: `${IMG}/chair-mesh.jpg`, width: 1400, height: 2100, objectPosition: "55% 40%",
    alt: "Flux ergonomic mesh chair with an adjustable headrest",
    shortDescription: "Adjustable lumbar, headrest and 4D arms.",
    description:
      "Built for long days. Independent lumbar depth, a headrest that tilts through 30°, 4D armrests and a seat slide, all adjustable without leaving the chair.",
    material: "Elastomeric mesh, nylon frame", dimensions: "W 66 × D 68 × H 115–128 cm", warrantyMonths: 60,
  },
  {
    slug: "aero-mesh-task-chair", sku: "CH-MSH-001", name: "Aero Mesh Task Chair",
    category: "mesh-chairs", price: 24900, stock: 31, bestseller: true, tone: "#E6D6BF",
    image: `${IMG}/chair-mesh.jpg`, width: 1400, height: 2100, objectPosition: "45% 72%",
    alt: "Aero mesh task chair seat and base",
    shortDescription: "The everyday mesh chair, without the headrest.",
    description:
      "The Flux chassis without the headrest and 4D arms — the same breathable back and synchronised tilt at a price that works for a whole floor.",
    material: "Elastomeric mesh, nylon frame", dimensions: "W 64 × D 66 × H 98–108 cm", warrantyMonths: 36,
  },
  {
    slug: "cadence-manager-chair", sku: "CH-MGR-001", name: "Cadence Manager Chair",
    category: "manager-chairs", price: 28000, stock: 17, tone: "#EADBC5",
    image: `${IMG}/chair-manager.jpg`, width: 1400, height: 1867, objectPosition: "18% 78%",
    alt: "Cadence manager chair in grey leather with chrome arms",
    shortDescription: "Mid-back leather with fixed loop arms.",
    description:
      "A mid-back chair for managers' offices and meeting rooms: padded leather seat, loop arms and a five-star chrome base on hard-floor castors.",
    material: "Bonded leather, chrome", dimensions: "W 62 × D 65 × H 96–106 cm", warrantyMonths: 24,
  },
  {
    slug: "bentwood-visitor-chair", sku: "CH-VIS-001", name: "Bentwood Visitor Chair",
    category: "visitor-chairs", price: 16500, stock: 42, featured: true, tone: "#EFE3CF",
    image: `${IMG}/chair-visitor.jpg`, width: 1400, height: 2100, objectPosition: "50% 78%",
    alt: "Bentwood visitor chairs around a round table in a warmly lit room",
    shortDescription: "Moulded walnut ply, stacks four high.",
    description:
      "A guest chair that does not look like office furniture. Moulded walnut plywood over a steel frame, stacking four high for storage between meetings.",
    material: "Walnut plywood, steel", dimensions: "W 54 × D 56 × H 78 cm", warrantyMonths: 24,
  },
  {
    slug: "lumen-walnut-standing-desk", sku: "DK-STD-001", name: "Lumen Walnut Standing Desk",
    category: "office-desks", price: 86000, compareAtPrice: 98000, stock: 7,
    featured: true, bestseller: true, badge: "Low stock", tone: "#EBDDC8",
    image: `${IMG}/desk-standing.jpg`, width: 1400, height: 2100, objectPosition: "50% 55%",
    alt: "Lumen walnut sit-stand desk with a live edge and black frame",
    shortDescription: "Solid walnut top on a dual-motor sit-stand frame.",
    description:
      "A solid walnut top with a lightly live edge, on a dual-motor frame that travels from 68 to 118 cm with four memory presets. Cable tray and grommet included.",
    material: "Solid walnut, powder-coated steel", dimensions: "W 160 × D 80 × H 68–118 cm", warrantyMonths: 120,
  },
  {
    slug: "maple-task-desk", sku: "DK-TSK-001", name: "Maple Task Desk",
    category: "office-desks", price: 54000, stock: 12, tone: "#E8D9C3",
    image: `${IMG}/desk-maple.jpg`, width: 1400, height: 2100, objectPosition: "60% 25%",
    alt: "Maple task desk with a shallow pencil drawer, seen from above",
    shortDescription: "Light maple top with an integrated pencil drawer.",
    description:
      "A fixed-height desk in light maple with a shallow full-width drawer and a white steel frame. Flat-packs to two cartons for upstairs offices.",
    material: "Maple veneer, steel", dimensions: "W 140 × D 70 × H 74 cm", warrantyMonths: 60,
  },
  {
    slug: "boardroom-conference-table-10", sku: "TB-CNF-010", name: "Boardroom Conference Table, 10-Seat",
    category: "conference-tables", price: 165000, stock: 3, featured: true, badge: "Made to order",
    tone: "#E6D5BD", image: `${IMG}/table-conference.jpg`, width: 1400, height: 933, objectPosition: "55% 55%",
    alt: "Ten-seat boardroom conference table with wooden chairs and a city view",
    shortDescription: "Four-metre veneered top with a cable spine.",
    description:
      "A four-metre boardroom table with a dark walnut veneer top, twin plinth bases and a concealed cable spine running the full length for power and data.",
    material: "Walnut veneer, solid edge", dimensions: "W 400 × D 120 × H 75 cm", warrantyMonths: 60,
  },
  {
    slug: "birch-office-shelving", sku: "ST-SHL-001", name: "Birch Office Shelving Unit",
    category: "office-storage", price: 38000, stock: 11, featured: true, tone: "#EDE0CB",
    image: `${IMG}/storage-shelving.jpg`, width: 1400, height: 1244, objectPosition: "72% 40%",
    alt: "Birch office shelving unit with closed base cabinets and open shelves",
    shortDescription: "Open shelving over closed base cabinets.",
    description:
      "Birch ply carcass with four open shelves over a pair of soft-close base cabinets. Wall-fixing brackets supplied; ships flat.",
    material: "Birch plywood", dimensions: "W 90 × D 40 × H 205 cm", warrantyMonths: 60,
  },
  {
    slug: "meridian-pedestal-drawers", sku: "ST-PED-001", name: "Meridian Mobile Pedestal",
    category: "office-storage", price: 19500, stock: 26, tone: "#E4D3BA",
    image: `${IMG}/desk-maple.jpg`, width: 1400, height: 2100, objectPosition: "48% 18%",
    alt: "Mobile pedestal drawer unit open beneath a maple desk",
    shortDescription: "Three-drawer mobile pedestal with a central lock.",
    description:
      "A three-drawer pedestal on castors that tucks under any of our desks. Central locking, full-extension runners and a top drawer divided for stationery.",
    material: "Maple veneer, steel", dimensions: "W 40 × D 55 × H 60 cm", warrantyMonths: 36,
  },
  {
    slug: "workstation-cluster-four", sku: "TB-WKS-004", name: "Linear Workstation Cluster, 4-Person",
    category: "office-tables", price: 142000, stock: 5, tone: "#E2D0B6",
    image: `${IMG}/showroom.jpg`, width: 1400, height: 753, objectPosition: "62% 55%",
    alt: "Four-person linear workstation cluster with screens and task chairs",
    shortDescription: "Back-to-back desking with acoustic screens.",
    description:
      "A four-person bench in back-to-back pairs with 350 mm acoustic screens, shared cable trays and a single power feed per pair. Add pedestals as needed.",
    material: "Laminate, powder-coated steel", dimensions: "W 280 × D 140 × H 74 cm", warrantyMonths: 60,
  },
];

// ────────────────────────── homepage content ──────────────────────────

const HOMEPAGE_SECTIONS = [
  { key: "hero", sortOrder: 1, eyebrow: "Office furniture · Since 1998",
    heading: "Built for work.", subheading: "Made to last.",
    bodyText: "Executive seating, ergonomic chairs, desks and boardroom tables — delivered and installed across Pakistan.",
    ctaLabel: "Shop the collection", ctaHref: "#shop", imagePath: `${IMG}/hero-wide.jpg` },
  { key: "trust", sortOrder: 2 },
  { key: "collections", sortOrder: 3, eyebrow: "Collections", heading: "Workspaces made calm",
    bodyText: "Four ranges, each built around honest materials and hardware that outlasts the warranty." },
  { key: "featured", sortOrder: 4, eyebrow: "Featured", heading: "Pieces we stand behind" },
  { key: "craft", sortOrder: 5, eyebrow: "Craftsmanship", heading: "Every joint tells a story",
    bodyText: "We choose slow-grown hardwood and join it the old way, so each piece stays tight and true for decades." },
  { key: "finishes", sortOrder: 6, eyebrow: "Finishes", heading: "Choose your wood" },
  { key: "testimonials", sortOrder: 7, eyebrow: "Kind words", heading: "Trusted by real offices" },
  { key: "visit", sortOrder: 8, eyebrow: "Showroom", heading: "Come sit, touch, stay a while",
    imagePath: `${IMG}/showroom.jpg` },
] as const;

// ─────────────────────────────── runner ───────────────────────────────

async function main() {
  console.log("Seeding Choice Office Furniture…\n");

  // --- settings (singleton) ---
  await prisma.websiteSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      brandName: "Choice Office Furniture",
      tagline: "Warm wood. Quiet design. Furniture that works as hard as you do.",
      // Placeholder — changed at /admin/settings, never in code.
      whatsappE164: "+923000000000",
      whatsappDisplay: "0300 0000000",
      email: "hello@choiceofficefurniture.pk",
      addressLine: "214 Maple Row",
      city: "Lahore",
      openingHours: "Open daily · 10:00 – 19:00",
      currencyCode: "PKR",
      currencySymbol: "Rs.",
      shippingFee: 0,
      shippingNote: "Free delivery and in-room installation nationwide.",
      metaTitle: "Choice Office Furniture — Workspaces built to last",
      metaDescription:
        "Executive, ergonomic and mesh office chairs, desks and conference tables, delivered and installed across Pakistan.",
      orderNumberPrefix: "ORD",
    },
  });
  console.log("  ✓ website settings");

  // --- first admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || adminPassword.startsWith("<")) {
    console.log("  — admin skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local)");
  } else if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  } else {
    const passwordHash = await hash(adminPassword, {
      // argon2id defaults tuned for an interactive login
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await prisma.adminUser.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: { passwordHash, isActive: true },
      create: { email: adminEmail.toLowerCase(), name: "Store Owner", passwordHash },
    });
    console.log(`  ✓ admin account (${adminEmail})`);
  }

  // --- categories ---
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        toneHex: category.toneHex,
        showOnHomepage: "showOnHomepage" in category ? category.showOnHomepage : false,
        isActive: "isActive" in category ? category.isActive : true,
        imagePath: "image" in category ? category.image : null,
      },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        toneHex: category.toneHex,
        showOnHomepage: "showOnHomepage" in category ? category.showOnHomepage : false,
        isActive: "isActive" in category ? category.isActive : true,
        imagePath: "image" in category ? category.image : null,
      },
    });
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);

  // --- products ---
  for (const [index, product] of PRODUCTS.entries()) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.category },
    });

    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        shortDescription: product.shortDescription,
        description: product.description,
        status: "PUBLISHED",
        isFeatured: product.featured ?? false,
        isBestseller: product.bestseller ?? false,
        badge: product.badge ?? null,
        toneHex: product.tone,
        imageObjectPosition: product.objectPosition,
        categoryId: category.id,
        sortOrder: index,
        material: product.material ?? null,
        dimensions: product.dimensions ?? null,
        warrantyMonths: product.warrantyMonths ?? null,
      },
      create: {
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        currency: "PKR",
        shortDescription: product.shortDescription,
        description: product.description,
        stockQuantity: product.stock,
        status: "PUBLISHED",
        publishedAt: new Date(),
        isFeatured: product.featured ?? false,
        isBestseller: product.bestseller ?? false,
        badge: product.badge ?? null,
        toneHex: product.tone,
        imageObjectPosition: product.objectPosition,
        categoryId: category.id,
        sortOrder: index,
        material: product.material ?? null,
        dimensions: product.dimensions ?? null,
        warrantyMonths: product.warrantyMonths ?? null,
      },
    });

    await prisma.productImage.upsert({
      where: { productId_storagePath: { productId: saved.id, storagePath: product.image } },
      update: { altText: product.alt, width: product.width, height: product.height, objectPosition: product.objectPosition },
      create: {
        productId: saved.id,
        storagePath: product.image,
        altText: product.alt,
        width: product.width,
        height: product.height,
        mimeType: "image/jpeg",
        objectPosition: product.objectPosition,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    /*
     * Opening stock goes through the ledger rather than straight onto the
     * column, so `stockQuantity` and the sum of its transactions agree from
     * the very first row — which is what makes the reconciliation query in
     * the admin meaningful.
     */
    const existingLedger = await prisma.inventoryTransaction.count({
      where: { productId: saved.id, reason: "INITIAL_STOCK" as InventoryReason },
    });
    if (existingLedger === 0) {
      await prisma.inventoryTransaction.create({
        data: {
          productId: saved.id,
          quantityDelta: product.stock,
          reason: "INITIAL_STOCK",
          resultingQuantity: product.stock,
          note: "Opening stock from seed",
        },
      });
    }
  }
  console.log(`  ✓ ${PRODUCTS.length} products with images and opening stock`);

  // --- homepage content ---
  for (const section of HOMEPAGE_SECTIONS) {
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      update: {},
      create: {
        key: section.key,
        sortOrder: section.sortOrder,
        eyebrow: "eyebrow" in section ? section.eyebrow : null,
        heading: "heading" in section ? section.heading : null,
        subheading: "subheading" in section ? section.subheading : null,
        bodyText: "bodyText" in section ? section.bodyText : null,
        ctaLabel: "ctaLabel" in section ? section.ctaLabel : null,
        ctaHref: "ctaHref" in section ? section.ctaHref : null,
        imagePath: "imagePath" in section ? section.imagePath : null,
      },
    });
  }
  console.log(`  ✓ ${HOMEPAGE_SECTIONS.length} homepage sections`);

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
