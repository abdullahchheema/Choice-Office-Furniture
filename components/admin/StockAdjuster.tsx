"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { adjustStockAction } from "@/lib/actions/inventory";

/** Inline +/- adjustment. Every change writes a ledger row server-side. */
export function StockAdjuster({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(sign: 1 | -1) {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole number");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adjustStockAction(variantId, sign * value);
      if (result?.error) setError(result.error);
      else {
        setAmount("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="numeric"
        aria-label="Adjustment amount"
        placeholder="0"
        className="w-16 rounded-md border border-line px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => apply(1)}
        className="rounded-md border border-line px-2 py-1 text-sm font-bold hover:bg-sand/50 disabled:opacity-50"
        aria-label="Add stock"
      >
        +
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => apply(-1)}
        className="rounded-md border border-line px-2 py-1 text-sm font-bold hover:bg-sand/50 disabled:opacity-50"
        aria-label="Remove stock"
      >
        −
      </button>
      {error ? (
        <span className="text-xs font-semibold text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
