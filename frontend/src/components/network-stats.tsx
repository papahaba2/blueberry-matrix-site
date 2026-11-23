"use client";

import { useProtocolData } from "@/hooks/useProtocolData";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100_000 ? 1 : 0,
  }).format(value);
}

function formatPrice(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 4 : 6,
  }).format(value);
}

export default function NetworkStats() {
  const {
    totalTvlUsd,
    totalVaultTvlUsd,
    lockedUsd,
    vaults,
    activeOrdersCount,
    executedCount,
    executedLoading,
    isLoading,
    prices,
    priceTs,
    priceStale,
    pricesLoading,
    managerConfigured,
  } = useProtocolData();

  const hasPrices = Object.keys(prices).length > 0;
  const hasMissingVaultPrice = vaults.some((vault) => vault.tvlUsd === null);
  const showTvl = !isLoading && !pricesLoading && hasPrices && !hasMissingVaultPrice;
  const updatedAt = priceTs
    ? `${new Date(priceTs).toLocaleString("ru-RU")}${priceStale ? " · stale" : ""}`
    : "—";

  const stats = [
    {
      label: "Total TVL (USD)",
      value: showTvl ? formatUsd(totalTvlUsd) : "—",
      note: showTvl
        ? "Vaults + locked limit orders"
        : hasMissingVaultPrice
          ? "Часть цен недоступна"
          : "Загружаем цены CoinGecko…",
    },
    {
      label: "Active limit orders",
      value: managerConfigured ? String(activeOrdersCount) : "—",
      note: managerConfigured ? "Live on V4LimitOrderManager" : "Manager not configured",
    },
    {
      label: "Orders executed",
      value:
        executedCount === null
          ? executedLoading
            ? "…"
            : "—"
          : String(executedCount),
      note:
        executedCount === null
          ? "Set manager deploy block to enable event scan"
          : "OrderExecuted events",
    },
    {
      label: "Keeper",
      value: "Active",
      note: "GitHub Actions · every 5 min",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="glass rounded-2xl p-4">
            <p className="label mb-0">{stat.label}</p>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.05em] text-white">
              {stat.value}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-faint">{stat.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label mb-0">TVL breakdown</p>
            <p className="font-mono text-[9px] text-faint">{updatedAt}</p>
          </div>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {vaults.map((vault) => (
              <div
                key={vault.config.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="text-[11px] text-muted">
                  {vault.config.name}
                </span>
                <span className="font-mono text-[11px] text-white">
                  {vault.tvlUsd === null ? "—" : formatUsd(vault.tvlUsd)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[11px] text-muted">
                Locked limit orders
              </span>
              <span className="font-mono text-[11px] text-white">
                {hasPrices ? formatUsd(lockedUsd) : "—"}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              Vaults only
            </span>
            <span className="font-mono text-[11px] text-brand-soft">
              {showTvl ? formatUsd(totalVaultTvlUsd) : "—"}
            </span>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="label">CoinGecko prices</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted">WFUSE</span>
              <span className="font-mono text-[11px] text-white">
                {formatPrice(prices.WFUSE)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted">USDC</span>
              <span className="font-mono text-[11px] text-white">
                {formatPrice(prices.USDC)}
              </span>
            </div>
          </div>
          <p className="mt-3 font-mono text-[9px] leading-4 text-faint">
            {pricesLoading ? "Обновляем цены…" : updatedAt}
          </p>
        </div>
      </div>
    </section>
  );
}
