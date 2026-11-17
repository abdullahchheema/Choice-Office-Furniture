import { Icon } from "@/components/layout/SvgSprite";
import { revealDelay } from "@/lib/utils";

const QUOTES = [
  {
    initial: "M",
    name: "Maya R.",
    product: "Oslo Dining Table",
    quote:
      "The Oslo table is the heart of our home. Two years on, it only looks better — every dinner leaves a little more character.",
  },
  {
    initial: "D",
    name: "Daniel & Priya",
    product: "Halden Sofa",
    quote:
      "Delivery was effortless, and the sofa is unbelievably comfortable. It feels calm and expensive without being fussy.",
  },
  {
    initial: "S",
    name: "Sofia L.",
    product: "Ashby Bed & Vale Table",
    quote:
      "I chose smoked walnut for the whole bedroom. The craftsmanship is obvious the moment you run your hand along the grain.",
  },
] as const;

export function Testimonials() {
  return (
    <section className="section" id="stories">
      <div className="shell">
        <header className="section-head" data-reveal>
          <p className="eyebrow">Kind words</p>
          <h2>
            Loved in <em>real homes</em>
          </h2>
        </header>

        <div className="quotes">
          {QUOTES.map((entry, index) => (
            <figure
              className="quote"
              key={entry.name}
              data-reveal
              style={index ? revealDelay(index * 100) : undefined}
            >
              {/* The group carries the rating; the individual stars are
                  decorative and hidden from assistive tech. */}
              <div className="stars" role="img" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }, (_, star) => (
                  <Icon name="i-star" key={star} />
                ))}
              </div>
              <blockquote>{`“${entry.quote}”`}</blockquote>
              <figcaption>
                <span className="avatar" aria-hidden="true">
                  {entry.initial}
                </span>
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.product}</small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
