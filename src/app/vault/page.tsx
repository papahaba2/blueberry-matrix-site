"use client";

import VaultCard from "@/components/vault-card";
import { useProtocolData } from "@/hooks/useProtocolData";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function VaultPage() {
  const {
    vaults,
    totalVaultTvlUsd,
    isLoading,
    refetch,
    priceTs,
    priceStale,
    pricesLoading,
  } = useProtocolData();

  return (
    <div className="page-shell py-10 md:py-16">
      <div className="eyebrow flex items-center gap-3">
        <span className="h-px w-8 bg-brand/70" />
        Automated yield
      </div>
      <h1 className="mt-5 max-w-[800px] font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
        Put your assets
        <br />
        <span className="text-brand-soft">to work.</span>
      </h1>
      <p className="mt-5 max-w-[540px] text-[13px] leading-6 text-muted">
        Deposit into a vault, receive ERC-4626 shares, and let the keeper rotate
        capital between approved Fuse strategies. Non-custodial and fully
        on-chain.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <p className="label">Combined vault TVL</p>
          <p className="mt-2 font-mono text-xl text-white">
            {isLoading || pricesLoading
              ? "—"
              : vaults.some((vault) => vault.tvlUsd === null)
                ? "—"
                : formatUsd(totalVaultTvlUsd)}
          </p>
          <p className="mt-1 font-mono text-[9px] text-faint">
            {vaults.some((vault) => vault.tvlUsd === null)
              ? "часть цен недоступна"
              : priceTs
                ? new Date(priceTs).toLocaleString("ru-RU")
                : "—"}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="label">Active vaults</p>
          <p className="mt-2 font-mono text-xl text-white">{vaults.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="label">Share standard</p>
          <p className="mt-2 font-mono text-xl text-white">ERC-4626</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="glass h-[340px] animate-pulse rounded-2xl bg-white/[0.02]"
              />
            ))
          : vaults.map((vault) => (
              <VaultCard
                key={vault.config.id}
                data={vault}
                onSuccess={refetch}
                priceTs={priceTs}
                priceStale={priceStale}
                priceLoading={pricesLoading}
              />
            ))}
      </div>
    </div>
  );
}
