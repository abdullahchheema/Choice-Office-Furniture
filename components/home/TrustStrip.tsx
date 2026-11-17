import { Icon } from "@/components/layout/SvgSprite";
import { revealDelay } from "@/lib/utils";

const PROMISES = [
  { icon: "i-truck", title: "Free delivery", copy: "White-glove, in-room setup" },
  { icon: "i-leaf", title: "Responsible timber", copy: "100% FSC certified" },
  { icon: "i-shield", title: "25-year guarantee", copy: "Built to last generations" },
  { icon: "i-return", title: "100-night trial", copy: "Easy, free returns" },
] as const;

/** Server component — `data-reveal` and `--d` are plain attributes that the
 *  app-level ScrollReveal observer picks up from the DOM. */
export function TrustStrip() {
  return (
    <section className="trust" id="trust" aria-label="Our promises">
      <div className="shell trust-grid">
        {PROMISES.map((promise, index) => (
          <div
            className="trust-item"
            key={promise.title}
            data-reveal
            style={index > 0 ? revealDelay(index * 80) : undefined}
          >
            <Icon name={promise.icon} />
            <div>
              <h3>{promise.title}</h3>
              <p>{promise.copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
