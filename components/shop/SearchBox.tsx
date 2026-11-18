"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { shopHref, type ShopFilters } from "@/lib/shop-filters";

/**
 * Search.
 *
 * A real form with a submit button, not a debounced keystroke listener: a
 * search-as-you-type field here would issue a server round trip per character
 * on a page whose results are server-rendered, and it would leave the URL — the
 * thing that makes a result shareable — in a half-typed state.
 */
export function SearchBox({ filters }: { filters: ShopFilters }) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(shopHref(filters, { q: value.trim(), page: 1 }));
      }}
    >
      <label
        htmlFor="shop-search"
        style={{
          display: "block",
          marginBottom: 10,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Search
      </label>
      <div className="search-row">
        <input
          id="shop-search"
          type="search"
          name="q"
          value={value}
          maxLength={80}
          placeholder="Mesh chair, desk…"
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="btn btn--ghost" style={{ padding: "10px 18px" }}>
          Go
        </button>
      </div>
      {filters.q ? (
        <button
          type="button"
          className="line-remove"
          style={{ marginLeft: 0, marginTop: 8 }}
          onClick={() => {
            setValue("");
            router.push(shopHref(filters, { q: "", page: 1 }));
          }}
        >
          Clear search
        </button>
      ) : null}
    </form>
  );
}
