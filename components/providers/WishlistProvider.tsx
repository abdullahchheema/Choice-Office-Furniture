"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { PRODUCTS_BY_ID } from "@/lib/catalog";
import { usePersistentState } from "@/lib/hooks";
import { useToast } from "@/components/providers/ToastProvider";

const STORAGE_KEY = "cof-wishlist-v1";

type WishlistContextValue = {
  ids: string[];
  hydrated: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds, hydrated] = usePersistentState<string[]>(STORAGE_KEY, []);
  const { toast } = useToast();

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id: string) => {
      const product = PRODUCTS_BY_ID.get(id);
      setIds((current) => {
        const next = current.includes(id)
          ? current.filter((entry) => entry !== id)
          : [...current, id];
        if (product) {
          toast(
            next.includes(id)
              ? `Saved ${product.name} to your wishlist`
              : `Removed ${product.name} from wishlist`,
          );
        }
        return next;
      });
    },
    [setIds, toast],
  );

  const value = useMemo(
    () => ({ ids, hydrated, has, toggle }),
    [ids, hydrated, has, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
