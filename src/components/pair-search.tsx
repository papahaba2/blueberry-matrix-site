"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllPools,
  getPoolProgress,
  getPoolSnapshot,
  poolFeeLabel,
  stopPoolScan,
  type PoolInfo,
  type PoolProgress,
} from "@/utils/getAllPools";

function addressColor(address: string): string {
  const n = Number.parseInt(address.slice(2, 8), 16) || 0;
  const hue = n % 360;
  return `hsl(${hue} 60% 55%)`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMillion(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export default function PairSearch({
  onSelect,
  refreshToken = 0,
}: {
  onSelect: (pool: PoolInfo) => void;
  refreshToken?: number;
}) {
  const [pools, setPools] = useState<PoolInfo[]>(() => getPoolSnapshot());
  const [query, setQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<PoolProgress>(() => getPoolProgress());
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = async (forceRefresh = false) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await getAllPools(forceRefresh);
      setPools(result);
      setLoaded(true);
      const nextProgress = getPoolProgress();
      setProgress(nextProgress);
      setLoading(nextProgress.running);
      if (result.length === 0) {
        setError("Не удалось загрузить пулы. Проверь RPC или повтори позже.");
      }
    } catch {
      setLoading(false);
      setError("Не удалось загрузить пулы.");
    }
  };

  useEffect(() => {
    if (!open && !loading) return;
    const interval = window.setInterval(() => {
      const snapshot = getPoolSnapshot();
      if (snapshot.length > 0) setPools(snapshot);
      const next = getPoolProgress();
      setProgress(next);
      if (!next.running) setLoading(false);
      if (next.error) {
        setError(
          next.error === "scan-limit"
            ? "Скан остановлен по таймауту/лимиту запросов. Продолжи с курсора."
            : `Ошибка RPC: ${next.error}`,
        );
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [loading, open]);

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
            <div className="px-3 py-3">
              <p className="text-[11px] text-muted">
                {formatMillion(progress.scanned)} / {formatMillion(progress.total)} блоков
                {" · "}найдено {progress.found} пулов
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.min(100, (progress.scanned / progress.total) * 100)
                        : 5
                    }%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => stopPoolScan()}
                className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-red-200 hover:text-white"
              >
                Stop scan
              </button>
            </div>
          )}

          {!loading && progress.error && (
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <p className="text-[10px] text-amber-200">
                Скан остановлен. Продолжить с блока{" "}
                {progress.scanned > 0
                  ? formatMillion(progress.scanned)
                  : "начала"}
                .
              </p>
              <button
                type="button"
                onClick={() => void load(false)}
                className="shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-brand-soft hover:text-white"
              >
                Continue
              </button>
            </div>
          )}

          {!loading && error && !progress.error && (
            <p className="px-3 py-4 text-[11px] text-red-200">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="px-3 py-4 text-[11px] text-muted">
              {loaded ? "No pools found." : "Focus the field to load pools."}
            </p>
          )}

          {filtered.map((pool) => (
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
