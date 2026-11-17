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
      /*
       * The toast fires here rather than inside the setIds updater. React may
       * run an updater during render, and toasting from there updates
       * ToastProvider mid-render — React warns "Cannot update a component
       * while rendering a different component", and the toast is unreliable.
       * Deciding the direction from the current state keeps it in the event
       * handler, where side effects belong.
       */
      const saving = !ids.includes(id);
      setIds((current) =>
        current.includes(id)
          ? current.filter((entry) => entry !== id)
          : [...current, id],
      );

      if (productName) {
        toast(
          saving
            ? `Saved ${productName} to your wishlist`
            : `Removed ${productName} from wishlist`,
        );
      }
    },
    [ids, setIds, toast],
  );

  const value = useMemo(() => ({ hydrated, has, toggle }), [hydrated, has, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
