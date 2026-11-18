"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { advanceOrder, type OrderActionState } from "@/lib/actions/orders";

const LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Pending confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_FOR_DISPATCH: "Ready for dispatch",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusForm({
  orderId,
  current,
  allowed,
  stockCommitted,
}: {
  orderId: string;
  current: string;
  allowed: string[];
  stockCommitted: boolean;
}) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    advanceOrder.bind(null, orderId),
    {},
  );

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        <strong className="text-espresso">{LABELS[current]}</strong> is a final
        status — there is nowhere further to move this order.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="status"
          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
        >
          Move to
        </label>
        <select
          id="status"
          name="status"
          defaultValue={allowed[0]}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
        >
          {allowed.map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="note"
          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
        >
          Note <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id="note"
          name="note"
          placeholder="Reason, courier, anything worth recording"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
        />
      </div>

      {/* Say plainly what the move will do to stock, before it happens. */}
      <p className="rounded-md bg-cream px-3 py-2 text-xs text-text-muted">
        {allowed.includes("CONFIRMED") && !stockCommitted
          ? "Confirming removes the ordered quantities from stock and records each movement in the ledger."
          : stockCommitted
            ? "Cancelling returns the ordered quantities to stock."
            : "This move does not change stock."}
      </p>

      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm font-semibold text-espresso">
          {state.message}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-espresso px-6 py-2.5 text-sm font-bold text-cream hover:bg-walnut disabled:opacity-60"
    >
      {pending ? "Updating…" : "Update status"}
    </button>
  );
}
