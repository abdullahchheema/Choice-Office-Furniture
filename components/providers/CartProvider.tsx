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

/**
 * The idempotency key for whatever order this cart becomes.
 *
 * Minted once, when the cart first becomes non-empty, and held until the cart
 * is cleared — so a double-click, Enter pressed twice, a browser-retried POST
 * and a second tab all submit the *same* key and all resolve to the one order.
 * Minting it at submit time instead would defeat the entire mechanism.
 */
const KEY_STORAGE_KEY = "cof-cart-key-v1";

type CartItem = { product: CartCatalogEntry; qty: number };

type CartContextValue = {
  items: CartItem[];
  /** Raw stored lines — what the checkout form submits. */
  lines: CartLine[];
  count: number;
  subtotalLabel: string;
  subtotalValue: number;
  currencySymbol: string;
  idempotencyKey: string | null;
  hydrated: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
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
  const [idempotencyKey, setIdempotencyKey] = usePersistentState<string | null>(
    KEY_STORAGE_KEY,
    null,
  );
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

  /* Display only. The real total is computed server-side on Decimal from
     database prices; this is never submitted and never trusted. */
  const subtotalValue = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.product.priceValue) * item.qty, 0),
    [items],
  );

  const subtotalLabel = useMemo(
    () =>
      `${currencySymbol} ${new Intl.NumberFormat("en-US").format(Math.round(subtotalValue))}`,
    [subtotalValue, currencySymbol],
  );

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
      // Mint the key the moment the cart stops being empty, not at submit.
      setIdempotencyKey((current) => current ?? crypto.randomUUID());
      toast(`${product.name} added to your cart`);
    },
    [byId, setLines, setIdempotencyKey, toast],
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

  /* The key is dropped with the lines: the next cart is a new order, and
     reusing the old key would make it resolve to the previous one. */
  const clear = useCallback(() => {
    setLines([]);
    setIdempotencyKey(null);
  }, [setLines, setIdempotencyKey]);

  const value = useMemo(
    () => ({
      items,
      lines,
      count,
      subtotalLabel,
      subtotalValue,
      currencySymbol,
      idempotencyKey,
      hydrated,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
      clear,
    }),
    [
      items,
      lines,
      count,
      subtotalLabel,
      subtotalValue,
      currencySymbol,
      idempotencyKey,
      hydrated,
      isOpen,
      add,
      setQty,
      remove,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
