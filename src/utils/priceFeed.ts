"use client";

import { useEffect, useMemo, useState } from "react";
import { COINGECKO_IDS } from "@/config";

const CACHE_KEY = "blueberry:prices:v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const API_URL = "https://api.coingecko.com/api/v3/simple/price";

type PriceCache = {
  prices: Record<string, number>;
  ts: number;
};

export type UsdPricesState = {
  prices: Record<string, number>;
  ts: number | null;
  stale: boolean;
  loading: boolean;
};

let inFlight: Promise<Record<string, number>> | null = null;
let inFlightKey = "";

export function readPriceCache(): PriceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PriceCache;
    if (!parsed?.prices || !parsed.ts) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePriceCache(prices: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PriceCache = { prices, ts: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Price cache is best-effort.
  }
}

function freshCache(): PriceCache | null {
  const cached = readPriceCache();
  if (!cached) return null;
  return Date.now() - cached.ts <= CACHE_TTL_MS ? cached : null;
}

async function requestPrices(ids: string[]): Promise<Record<string, number>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    const url = `${API_URL}?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
    const payload = (await response.json()) as Record<
      string,
      { usd?: number } | undefined
    >;

    const prices: Record<string, number> = {};
    for (const id of ids) {
      const value = payload[id]?.usd;
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        prices[id] = value;
      }
    }
    if (Object.keys(prices).length === 0) {
      throw new Error("CoinGecko returned no usable prices");
    }
    writePriceCache({ ...(readPriceCache()?.prices ?? {}), ...prices });
    return prices;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Fetch all requested CoinGecko ids in one request.
 * Never throws: on failure it returns stale cache when available.
 */
export async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0 || typeof window === "undefined") return {};

  const fresh = freshCache();
  if (fresh) {
    const missing = unique.filter((id) => !(id in fresh.prices));
    if (missing.length === 0) return fresh.prices;
  }

  if (inFlight && inFlightKey === unique.slice().sort().join(",")) {
    return inFlight;
  }

  inFlightKey = unique.slice().sort().join(",");
  inFlight = requestPrices(unique)
    .catch(() => {
      const stale = readPriceCache();
      return stale?.prices ?? {};
    })
    .finally(() => {
      inFlight = null;
      inFlightKey = "";
    });

  return inFlight;
}

export function useUsdPrices(symbols: string[]): UsdPricesState {
  const ids = useMemo(
    () =>
      Array.from(
        new Set(
          symbols
            .map((symbol) => COINGECKO_IDS[symbol.toUpperCase()])
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    [symbols],
  );

  const [state, setState] = useState<UsdPricesState>({
    prices: {},
    ts: null,
    stale: false,
    loading: ids.length > 0,
  });
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setState({ prices: {}, ts: null, stale: false, loading: false });
      return;
    }

    let active = true;
    setState((previous) => ({ ...previous, loading: true }));

    void fetchPrices(ids).then((prices) => {
      if (!active) return;
      const cached = readPriceCache();
      const ts = cached?.ts ?? null;
      setState({
        prices,
        ts,
        stale: !ts || Date.now() - ts > CACHE_TTL_MS,
        loading: false,
      });
    });

    return () => {
      active = false;
    };
    // key is the stable representation of ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const symbolPrices = useMemo(() => {
    const mapped: Record<string, number> = {};
    for (const symbol of symbols) {
      const normalized = symbol.toUpperCase();
      const id = COINGECKO_IDS[normalized];
      const value = id ? state.prices[id] : undefined;
      if (typeof value === "number") mapped[normalized] = value;
    }
    return mapped;
    // state.prices is the id-keyed cache result.
  }, [state.prices, symbols]);

  return { ...state, prices: symbolPrices };
}

export function useUsdPrice(symbol: string): {
  price: number | null;
  ts: number | null;
  stale: boolean;
  loading: boolean;
} {
  const state = useUsdPrices([symbol]);
  return {
    price: state.prices[symbol.toUpperCase()] ?? null,
    ts: state.ts,
    stale: state.stale,
    loading: state.loading,
  };
}
