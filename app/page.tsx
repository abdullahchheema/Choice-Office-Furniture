import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { CraftSection } from "@/components/home/CraftSection";
import { FinishPicker } from "@/components/home/FinishPicker";
import { Hero } from "@/components/home/Hero";
import { ShopSection } from "@/components/home/ShopSection";
import { Testimonials } from "@/components/home/Testimonials";
import { TrustStrip } from "@/components/home/TrustStrip";
import { VisitSection } from "@/components/home/VisitSection";

/**
 * Homepage — the same section order as the original single-page site.
 *
 * Static for now; Phase 3 swaps the hardcoded catalog for database queries,
 * at which point the product sections start fetching here.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <CollectionsGrid />
      <ShopSection />
      <CraftSection />
      <FinishPicker />
      <Testimonials />
      <VisitSection />
    </>
  );
}
