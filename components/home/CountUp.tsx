"use client";

import { useCountUp } from "@/lib/hooks";

/**
 * A single animated figure.
 *
 * Kept as the smallest possible client leaf so the craft section around it
 * stays a Server Component.
 */
export function CountUp({ value, threshold }: { value: number; threshold?: number }) {
  const { ref, display } = useCountUp(value, threshold);
  return <span ref={ref}>{display}</span>;
}
