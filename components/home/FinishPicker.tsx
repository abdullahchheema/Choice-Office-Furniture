"use client";

import { useState } from "react";

import { Icon } from "@/components/layout/SvgSprite";
import { DEFAULT_FINISH, FINISHES, type FinishKey } from "@/lib/finishes";
import { revealDelay } from "@/lib/utils";

export function FinishPicker() {
  const [selected, setSelected] = useState<FinishKey>(DEFAULT_FINISH);
  const finish = FINISHES.find((entry) => entry.key === selected) ?? FINISHES[0];

  return (
    <section className="section section--tint" id="finishes">
      <div className="shell finish-grid">
        <div className="finish-stage" data-reveal>
          <svg
            className="art finish-art"
            viewBox="0 0 400 300"
            role="img"
            aria-label={`Lund lounge chair shown in ${finish.name}`}
            style={
              {
                "--wood": finish.wood,
                "--wood-dk": finish.dark,
                "--wood-lt": finish.light,
              } as React.CSSProperties
            }
          >
            <use href="#art-lounge" />
          </svg>
        </div>

        <div className="finish-copy">
          <p className="eyebrow" data-reveal>
            Finishes
          </p>
          <h2 data-reveal style={revealDelay(60)}>
            Choose your <em>wood</em>
          </h2>
          <p className="lede" data-reveal style={revealDelay(120)}>
            Every piece is available in five natural finishes. Tap a swatch to
            see it on the Lund Lounge Chair.
          </p>

          <fieldset className="swatches" data-reveal style={revealDelay(180)}>
            <legend className="sr-only">Wood finish</legend>
            {FINISHES.map((entry) => (
              <label className="swatch" key={entry.key}>
                <input
                  type="radio"
                  name="finish"
                  value={entry.key}
                  checked={selected === entry.key}
                  onChange={() => setSelected(entry.key)}
                />
                <span
                  className="swatch-dot"
                  style={{ "--c": entry.wood } as React.CSSProperties}
                />
                <span className="swatch-label">{entry.name}</span>
              </label>
            ))}
          </fieldset>

          {/*
            Keying on the finish remounts the heading and copy, which restarts
            the `swap` keyframes. The original removed, reflowed and re-added a
            class to force the same replay; a remount is React's version of
            that and needs no DOM poking.
          */}
          <div className="finish-info swap" data-reveal style={revealDelay(240)} aria-live="polite">
            <h3 key={`${finish.key}-name`}>{finish.name}</h3>
            <p key={`${finish.key}-desc`}>{finish.description}</p>
          </div>

          <a className="btn btn--primary" href="#shop" data-reveal style={revealDelay(300)}>
            Browse all pieces <Icon name="i-arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
