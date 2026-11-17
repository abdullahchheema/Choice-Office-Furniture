"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { PRODUCTS_BY_ID, type Product } from "@/lib/catalog";
import { usePersistentState } from "@/lib/hooks";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * A stored line holds an id and a quantity and nothing else.
 *
 * Prices are never persisted. The original kept them out of storage too, but
 * only incidentally — it re-read them from the DOM. Here it is the deliberate
 * trust boundary that carries into Phase 5: the client says what and how many,
 * the server decides what it costs.
 */
export type CartLine = { id: string; qty: number };

/** Namespaced and versioned. Product ids become database ids in Phase 3, so a
 *  cart saved today must be discarded rather than silently mis-resolved. */
const STORAGE_KEY = "cof-cart-v1";

type CartContextValue = {
  lines: CartLine[];
  /** Lines joined to their product, with anything unresolvable dropped. */
  items: { product: Product; qty: number }[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines, hydrated] = usePersistentState<CartLine[]>(STORAGE_KEY, []);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const items = useMemo(
    () =>
      lines
        .map((line) => {
          const product = PRODUCTS_BY_ID.get(line.id);
          return product ? { product, qty: line.qty } : null;
        })
        .filter((entry): entry is { product: Product; qty: number } => entry !== null),
    [lines],
  );

  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((n, i) => n + i.product.price * i.qty, 0),
    [items],
  );

  const add = useCallback(
    (id: string) => {
      const product = PRODUCTS_BY_ID.get(id);
      if (!product) return;
      setLines((current) => {
        const existing = current.find((line) => line.id === id);
        return existing
          ? current.map((line) => (line.id === id ? { ...line, qty: line.qty + 1 } : line))
          : [...current, { id, qty: 1 }];
      });
      toast(`${product.name} added to your cart`);
    },
    [setLines, toast],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      setLines((current) =>
        current.map((line) => (line.id === id ? { ...line, qty: Math.max(1, qty) } : line)),
      );
    },
    [setLines],
  );

  const remove = useCallback(
    (id: string) => setLines((current) => current.filter((line) => line.id !== id)),
    [setLines],
  );

  const value = useMemo(
    () => ({
      lines,
      items,
      count,
      subtotal,
      hydrated,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
    }),
    [lines, items, count, subtotal, hydrated, isOpen, add, setQty, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
