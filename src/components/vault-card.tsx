"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import DepositModal from "@/components/deposit-modal";
import WithdrawModal from "@/components/withdraw-modal";
import { explorerAddress } from "@/config";
import type { VaultData } from "@/hooks/useProtocolData";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export default function VaultCard({
  data,
  onSuccess,
  priceTs,
  priceStale,
  priceLoading,
}: {
  data: VaultData;
  onSuccess: () => void;
  priceTs: number | null;
  priceStale: boolean;
  priceLoading: boolean;
}) {
  const { isConnected } = useAccount();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { config } = data;

  return (
    <>
      <article className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Vault</p>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-white">
              {config.name}
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-brand-soft">
              {config.shareSymbol}
            </p>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-200">
            Live
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.07] pt-4">
          <div>
            <p className="label">TVL</p>
            <p className="font-mono text-lg text-white">
              {data.tvlUsd === null ? "—" : formatUsd(data.tvlUsd)}
            </p>
            <p className="mt-1 font-mono text-[9px] text-faint">
              {priceLoading
                ? "загружаем цену…"
                : data.tvlUsd === null
                  ? "цена недоступна"
                  : priceTs
                    ? `${new Date(priceTs).toLocaleString("ru-RU")}${priceStale ? " · stale" : ""}`
                    : "—"}
            </p>
          </div>
          <div>
            <p className="label">APR</p>
            <p className="font-mono text-lg text-white">
              {config.aprBps > 0
                ? `${(config.aprBps / 100).toFixed(2)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="label">Your balance</p>
            <p className="font-mono text-sm text-white">
              {formatUnits(data.userAssets, config.asset.decimals)}{" "}
              {config.asset.symbol}
            </p>
          </div>
          <div>
            <p className="label">Available shares</p>
            <p className="font-mono text-sm text-white">
              {formatUnits(data.userShares, 18)} {config.shareSymbol}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => setDepositOpen(true)}
            disabled={!isConnected}
          >
            {isConnected ? "Deposit" : "Connect wallet"}
          </button>
          <button
            type="button"
            className="btn-ghost flex-1"
            onClick={() => setWithdrawOpen(true)}
            disabled={!isConnected || data.userShares === 0n}
          >
            Withdraw
          </button>
        </div>

        <a
          href={explorerAddress(config.address)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex font-mono text-[9px] uppercase tracking-[0.14em] text-faint hover:text-white"
        >
          View vault on explorer ↗
        </a>
      </article>

      <DepositModal
        vault={config}
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={onSuccess}
      />
      <WithdrawModal
        vault={config}
        shares={data.userShares}
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}
