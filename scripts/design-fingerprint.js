/**
 * Design fingerprint — the migration's mechanical regression check.
 *
 * Paste/evaluate this in a page and it returns a JSON snapshot of computed
 * styles for the selectors that define the storefront's look. Run it against
 * a previous build (any earlier commit, `npm run dev`) and against the current
 * one, then diff the two objects. (The original static site that served as the
 * baseline during the migration was removed in Phase 7; it remains in git
 * history before that commit.)
 *
 * This beats comparing screenshots for the failures most likely in this
 * migration, because it names the broken property instead of leaving you to
 * spot a few pixels by eye. Two entries are deliberate canaries:
 *   - `.card-cat` / `.lede` colour  -> rgb(107, 88, 72). If these go beige,
 *     the `--muted` vs shadcn `--muted` collision has regressed.
 *   - `.tile` / `.card-media` radius -> 22px. If these drop to ~10px, the
 *     `--radius` collision has regressed.
 *
 * Usage in the browser console:
 *   copy(JSON.stringify(__fingerprint(), null, 2))
 */
(() => {
  const SPECS = [
    ["body", ["backgroundColor", "color", "fontFamily", "fontWeight", "fontSize", "lineHeight"]],
    ["h1.hero-title", ["fontFamily", "fontWeight", "fontSize", "letterSpacing", "lineHeight", "color"]],
    [".hero", ["minHeight", "backgroundColor"]],
    [".hero-lede", ["color", "fontWeight", "fontSize"]],
    [".eyebrow", ["color", "fontSize", "letterSpacing", "fontWeight", "textTransform"]],
    [".lede", ["color", "fontSize", "maxWidth"]],
    [".btn--primary", ["backgroundColor", "color", "minHeight", "borderRadius", "paddingLeft", "fontWeight"]],
    [".btn--ghost", ["borderColor", "color", "borderRadius"]],
    [".trust", ["backgroundColor"]],
    [".trust-item h3", ["fontFamily", "fontSize", "fontWeight"]],
    [".section--tint", ["backgroundColor"]],
    [".tile", ["borderRadius", "padding"]],
    [".tile-meta h3", ["fontSize", "color"]],
    [".chip", ["minHeight", "borderRadius", "borderColor", "fontSize"]],
    [".chip.is-active", ["backgroundColor", "color"]],
    [".card-media", ["borderRadius", "aspectRatio"]],
    [".card-body h3", ["fontSize", "fontFamily", "lineHeight"]],
    [".price", ["fontWeight", "fontSize"]],
    [".card-cat", ["color", "fontSize", "letterSpacing"]],
    [".craft-photo", ["borderRadius", "aspectRatio"]],
    [".craft-stat strong", ["fontFamily", "fontSize", "color"]],
    [".craft-list p", ["color", "fontSize"]],
    [".stats dd", ["fontFamily", "fontSize"]],
    [".finish-stage", ["borderRadius", "aspectRatio"]],
    [".swatch-dot", ["width", "height", "borderRadius"]],
    [".quote", ["backgroundColor", "borderRadius", "padding"]],
    [".quote blockquote", ["fontFamily", "fontSize", "lineHeight", "color"]],
    [".avatar", ["backgroundColor", "color", "width"]],
    [".visit", ["backgroundColor", "color"]],
    [".signup", ["borderRadius", "backgroundColor"]],
    [".field input", ["minHeight", "borderRadius", "borderColor", "color"]],
    [".site-footer", ["backgroundColor", "paddingTop"]],
    [".site-footer h4", ["color", "fontSize", "letterSpacing"]],
    [".footer-bottom", ["color", "fontSize"]],
    [".drawer", ["width", "backgroundColor"]],
    [".toast", ["backgroundColor", "color", "borderRadius"]],
    [".container", ["width"]],
  ];

  /** Elements whose presence is itself breakpoint-dependent. */
  const PRESENCE = [".hero-visual", ".scroll-cue", ".menu-btn", ".nav", ".hero-badge"];

  window.__fingerprint = function fingerprint() {
    const styles = {};
    for (const [sel, props] of SPECS) {
      const el = document.querySelector(sel);
      if (!el) {
        styles[sel] = "__MISSING__";
        continue;
      }
      const cs = getComputedStyle(el);
      styles[sel] = Object.fromEntries(props.map((p) => [p, cs[p]]));
    }

    const presence = {};
    for (const sel of PRESENCE) {
      const el = document.querySelector(sel);
      presence[sel] = el ? getComputedStyle(el).display : "__MISSING__";
    }

    return {
      viewport: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      images: {
        total: document.images.length,
        broken: [...document.images].filter(
          (i) => i.complete && i.naturalWidth === 0,
        ).length,
      },
      fontVariationOnH2: (() => {
        const h2 = document.querySelector("h2");
        return h2 ? getComputedStyle(h2).fontVariationSettings : "__MISSING__";
      })(),
      presence,
      styles,
    };
  };

  return window.__fingerprint();
})();
