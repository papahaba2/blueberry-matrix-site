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

export default function NetworkStats() {
  const {
    totalTvlUsd,
    activeOrdersCount,
    executedCount,
    executedLoading,
    isLoading,
    managerConfigured,
  } = useProtocolData();

  const stats = [
    {
      label: "Total TVL",
      value: isLoading ? "—" : formatUsd(totalTvlUsd),
      note: "Vaults + locked limit orders",
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
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="glass rounded-2xl p-4">
          <p className="label mb-0">{stat.label}</p>
          <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.05em] text-white">
            {stat.value}
          </p>
          <p className="mt-2 text-[10px] leading-4 text-faint">{stat.note}</p>
        </article>
      ))}
    </section>
  );
}
