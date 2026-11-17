import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui class combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Typed helper for the per-element reveal stagger.
 *
 * storefront.css reads `--d` as a transition-delay on `[data-reveal]`, and the
 * original markup set it inline (`style="--d:80ms"`). React accepts custom
 * properties in `style` at runtime but TypeScript's CSSProperties rejects them,
 * so this keeps the cast in one place instead of scattered through components.
 */
export function revealDelay(ms: number): React.CSSProperties {
  return { "--d": `${ms}ms` } as React.CSSProperties;
}
