"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { usePersistentState } from "@/lib/hooks";
import type { CartCatalogEntry } from "@/lib/queries";

/**
 * A stored line holds an id and a quantity and nothing else.
 *
 * Prices are never persisted. The catalog is supplied by the server on every
 * render, so a price changed in the admin shows immediately and a cart saved
 * last week can never display a stale amount. Phase 5's checkout re-prices
 * from the database again regardless — the client is never trusted with money.
 */
export type CartLine = { id: string; qty: number };

/** Namespaced and versioned: product ids changed shape when the database
 *  arrived, so anything saved under an older key is discarded, not misread. */
const STORAGE_KEY = "cof-cart-v2";

type CartItem = { product: CartCatalogEntry; qty: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalLabel: string;
  hydrated: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  catalog,
  currencySymbol = "Rs.",
  children,
}: {
  catalog: CartCatalogEntry[];
  currencySymbol?: string;
  children: React.ReactNode;
}) {
  const [lines, setLines, hydrated] = usePersistentState<CartLine[]>(STORAGE_KEY, []);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const byId = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry])),
    [catalog],
  );

  /* Lines whose product has since been unpublished or deleted simply drop out
     rather than rendering as a broken row. */
  const items = useMemo(
    () =>
      lines
        .map((line) => {
          const product = byId.get(line.id);
          return product ? { product, qty: line.qty } : null;
        })
        .filter((entry): entry is CartItem => entry !== null),
    [lines, byId],
  );

  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);

  const subtotalLabel = useMemo(() => {
    const total = items.reduce(
      (sum, item) => sum + Number(item.product.priceValue) * item.qty,
      0,
    );
    return `${currencySymbol} ${new Intl.NumberFormat("en-US").format(Math.round(total))}`;
  }, [items, currencySymbol]);

  const add = useCallback(
    (id: string) => {
      const product = byId.get(id);
      if (!product) return;
      setLines((current) => {
        const existing = current.find((line) => line.id === id);
        return existing
          ? current.map((line) => (line.id === id ? { ...line, qty: line.qty + 1 } : line))
          : [...current, { id, qty: 1 }];
      });
      toast(`${product.name} added to your cart`);
    },
    [byId, setLines, toast],
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
      items,
      count,
      subtotalLabel,
      hydrated,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
    }),
    [items, count, subtotalLabel, hydrated, isOpen, add, setQty, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
