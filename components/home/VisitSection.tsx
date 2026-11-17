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
            Experience the grain and the comfort in person. Our showroom is open
            daily, and our team is happy to help you plan a room.
          </p>

          <figure className="visit-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/showroom.jpg"
              width={1200}
              height={795}
              loading="lazy"
              decoding="async"
              alt="Bright open-plan showroom with a cream lounge chair, oak floors and a long dining counter"
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
