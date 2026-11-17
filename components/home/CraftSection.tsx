import { CountUp } from "@/components/home/CountUp";
import { revealDelay } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    title: "Sourced responsibly",
    copy: "Solid oak, walnut and ash from FSC-certified forests, kiln-dried for stability.",
  },
  {
    num: "02",
    title: "Joined by hand",
    copy: "No shortcuts: traditional joinery, glued and pegged, then sanded to a silk finish.",
  },
  {
    num: "03",
    title: "Finished with oil",
    copy: "Plant-based hardwax oils that let the grain breathe and age gracefully.",
  },
] as const;

export function CraftSection() {
  return (
    <section className="section craft" id="craft">
      <div className="shell craft-grid">
        {/* `.craft-visual.in` drives the slow zoom-out on the photo inside, so
            the reveal class has to land on this exact element. */}
        <div className="craft-visual" data-reveal>
          <div className="craft-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/craft-1.jpg"
              width={900}
              height={1350}
              loading="lazy"
              decoding="async"
              alt="A craftsman hand-planing a curved walnut moulding at the workbench"
            />
          </div>
          <div className="craft-inset">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/craft-2.jpg"
              width={1200}
              height={606}
              loading="lazy"
              decoding="async"
              alt="Close-up of a chisel carving fresh pine with curled shavings"
            />
          </div>
          <div className="craft-stat">
            <strong>
              <CountUp value={25} threshold={0.6} />
            </strong>
            <span>
              year
              <br />
              guarantee
            </span>
          </div>
        </div>

        <div className="craft-copy">
          <p className="eyebrow" data-reveal>
            Craftsmanship
          </p>
          <h2 data-reveal style={revealDelay(60)}>
            Every ring tells <em>a story</em>
          </h2>
          <p className="lede" data-reveal style={revealDelay(120)}>
            We choose slow-grown hardwood and join it the old way — mortise,
            tenon and dovetail — so each piece stays tight, true and beautiful
            for decades.
          </p>

          <ul className="craft-list">
            {STEPS.map((step, index) => (
              <li key={step.num} data-reveal style={revealDelay(160 + index * 60)}>
                <span className="num">{step.num}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </li>
            ))}
          </ul>

          <dl className="stats" data-reveal style={revealDelay(340)}>
            <div>
              <dt>Homes furnished</dt>
              <dd>
                <CountUp value={12400} />+
              </dd>
            </div>
            <div>
              <dt>Master makers</dt>
              <dd>
                <CountUp value={38} />
              </dd>
            </div>
            <div>
              <dt>Certified timber</dt>
              <dd>
                <CountUp value={100} />%
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
