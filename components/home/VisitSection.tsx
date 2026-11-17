import { NewsletterForm } from "@/components/home/NewsletterForm";
import { Icon } from "@/components/layout/SvgSprite";

export function VisitSection() {
  return (
    <section className="visit" id="visit">
      <div className="shell visit-grid">
        <div className="visit-copy" data-reveal>
          <p className="eyebrow eyebrow--light">Showroom</p>
          <h2>
            Come sit, touch, <em>stay a while</em>
          </h2>
          <p className="lede">
            Sit in the chairs and measure the desks before you commit. Our team
            will plan a full floor with you, free of charge.
          </p>

          <figure className="visit-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/office/showroom.jpg"
              width={1400}
              height={753}
              loading="lazy"
              decoding="async"
              alt="Open-plan showroom floor with rows of desks, task chairs and acoustic screens"
            />
          </figure>

          <ul className="visit-info">
            <li>
              <Icon name="i-pin" />
              <span>
                214 Maple Row, Woodside
                <br />
                Open daily · 10:00 – 19:00
              </span>
            </li>
          </ul>
        </div>

        <NewsletterForm />
      </div>
    </section>
  );
}
