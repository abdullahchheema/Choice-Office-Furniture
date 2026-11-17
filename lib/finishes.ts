/**
 * Wood finishes for the finish picker.
 *
 * In the original these lived twice — once in the HTML for the default state
 * and again in script.js for the swap — which meant the oak description could
 * drift between the two. Here they exist once and the markup renders from it.
 */

export type FinishKey = "oak" | "walnut" | "ash" | "cherry" | "ebony";

export type Finish = {
  key: FinishKey;
  name: string;
  /** The swatch dot colour, and the base wood tone applied to the SVG. */
  wood: string;
  dark: string;
  light: string;
  description: string;
};

export const FINISHES: Finish[] = [
  {
    key: "oak",
    name: "Natural Oak",
    wood: "#C8A06E",
    dark: "#8E6A3F",
    light: "#E0C497",
    description:
      "Light, open grain with honey undertones. Brightens a room and pairs with everything.",
  },
  {
    key: "walnut",
    name: "Smoked Walnut",
    wood: "#7A5233",
    dark: "#4A2F1B",
    light: "#9A7350",
    description:
      "Deep chocolate tones with rich, flowing grain. Quietly dramatic and endlessly warm.",
  },
  {
    key: "ash",
    name: "Pale Ash",
    wood: "#DCC9A8",
    dark: "#B09A74",
    light: "#EBDDC3",
    description:
      "Soft, airy and Scandinavian. A calm canvas for light-filled, minimal spaces.",
  },
  {
    key: "cherry",
    name: "Cherry",
    wood: "#A4562F",
    dark: "#6B3118",
    light: "#C27A52",
    description:
      "A warm reddish glow that deepens beautifully with age and sunlight.",
  },
  {
    key: "ebony",
    name: "Ebonised",
    wood: "#3E3028",
    dark: "#241A14",
    light: "#5A4A40",
    description:
      "Dark, refined and graphic. The grain still shows through the hand-rubbed oil.",
  },
];

export const DEFAULT_FINISH: FinishKey = "oak";
