"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllPools,
  poolFeeLabel,
  type PoolInfo,
} from "@/utils/getAllPools";

function addressColor(address: string): string {
  const n = Number.parseInt(address.slice(2, 8), 16) || 0;
  const hue = n % 360;
  return `hsl(${hue} 60% 55%)`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function PairSearch({
  onSelect,
  refreshToken = 0,
}: {
  onSelect: (pool: PoolInfo) => void;
  refreshToken?: number;
}) {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [query, setQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = async (forceRefresh = false) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await getAllPools(forceRefresh);
      setPools(result);
      setLoaded(true);
      if (result.length === 0) {
        setError("Не удалось загрузить пулы. Проверь RPC или повтори позже.");
      }
    } catch {
      setError("Не удалось загрузить пулы.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (refreshToken > 0) {
      setSelectedAddress("");
      setQuery("");
      setLoaded(false);
      void load(true);
    }
    // load is intentionally recreated from current component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pools.slice(0, 40);
    return pools
      .filter(
        (pool) =>
          pool.symbol0.toLowerCase().includes(needle) ||
          pool.symbol1.toLowerCase().includes(needle) ||
          pool.name.toLowerCase().includes(needle) ||
          pool.token0.toLowerCase().includes(needle) ||
          pool.token1.toLowerCase().includes(needle) ||
          pool.poolAddress.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [pools, query]);

  const select = (pool: PoolInfo) => {
    setSelectedAddress(pool.poolAddress);
    setQuery(`${pool.name} · ${poolFeeLabel(pool.fee)}`);
    setOpen(false);
    console.log("[pool] selected", pool.poolAddress, pool.name, pool.fee, pool.tickSpacing);
    onSelect(pool);
  };

  return (
    <div ref={wrapperRef} className="relative" data-selected-pool={selectedAddress}>
      <input type="hidden" name="poolAddress" value={selectedAddress} readOnly />
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className="field pr-9"
            placeholder="Search all Algebra pools…"
            value={query}
            onFocus={() => {
              setOpen(true);
              if (!loaded && !loading) void load(false);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            aria-label="Search pools"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-faint">
            ⌕
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-white/[0.18] hover:text-white disabled:opacity-40"
          onClick={() => void load(true)}
          disabled={loading}
          title="Refresh pools"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0d0a12] p-1 shadow-2xl">
          {loading && (
            <p className="px-3 py-4 text-[11px] text-muted">
              Indexing pools from Factory events… this can take a moment.
            </p>
          )}

          {!loading && error && (
            <p className="px-3 py-4 text-[11px] text-red-200">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="px-3 py-4 text-[11px] text-muted">
              {loaded ? "No pools found." : "Focus the field to load pools."}
            </p>
          )}

          {!loading &&
            filtered.map((pool) => (
              <button
                key={pool.poolAddress}
                type="button"
                onClick={() => select(pool)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="flex -space-x-1">
                  <i
                    className="h-5 w-5 rounded-full border border-black/40"
                    style={{ background: addressColor(pool.token0) }}
                  />
                  <i
                    className="h-5 w-5 rounded-full border border-black/40"
                    style={{ background: addressColor(pool.token1) }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] text-white">
                    {pool.name}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-faint">
                    {shortAddress(pool.poolAddress)}
                  </span>
                </span>
                <span className="shrink-0 rounded-md border border-white/[0.08] px-1.5 py-1 font-mono text-[8px] text-muted">
                  {poolFeeLabel(pool.fee)} · {pool.tickSpacing}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
