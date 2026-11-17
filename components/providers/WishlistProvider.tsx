"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { usePersistentState } from "@/lib/hooks";

const STORAGE_KEY = "cof-wishlist-v2";

type WishlistContextValue = {
  hydrated: boolean;
  has: (id: string) => boolean;
  /** The name is passed in by the caller, which already has it, rather than
   *  this provider holding a second copy of the catalog. */
  toggle: (id: string, productName?: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds, hydrated] = usePersistentState<string[]>(STORAGE_KEY, []);
  const { toast } = useToast();

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id: string, productName?: string) => {
      setIds((current) => {
        const saving = !current.includes(id);
        const next = saving
          ? [...current, id]
          : current.filter((entry) => entry !== id);

        if (productName) {
          toast(
            saving
              ? `Saved ${productName} to your wishlist`
              : `Removed ${productName} from wishlist`,
          );
        }
        return next;
      });
    },
    [setIds, toast],
  );

  const value = useMemo(() => ({ hydrated, has, toggle }), [hydrated, has, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
