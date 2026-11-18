"use client";

import { useEffect, useRef } from "react";

import { useCart } from "@/components/providers/CartProvider";

/**
 * Empties the cart once the order exists.
 *
 * Deliberately here and not in the checkout action: the cart lives in
 * localStorage, which the server cannot touch, and clearing it optimistically
 * before the write would throw the cart away on any failure. By the time this
 * page renders the order is committed, so it is safe.
 */
export function ClearCartOnMount() {
  const { clear, hydrated } = useCart();
  const done = useRef(false);

  useEffect(() => {
    // Wait for hydration, or clear() writes [] over a cart that has not been
    // read back from storage yet — and then the read restores it.
    if (!hydrated || done.current) return;
    done.current = true;
    clear();
  }, [hydrated, clear]);

  return null;
}
