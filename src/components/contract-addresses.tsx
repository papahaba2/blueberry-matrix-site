"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CONTRACTS,
  VAULTS,
  explorerAddress,
  isManagerConfigured,
} from "@/config";

function short(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function ContractAddresses() {
  const [copied, setCopied] = useState<string | null>(null);

  const rows = [
    {
      label: "V4LimitOrderManager",
      address: CONTRACTS.limitOrderManager,
      configured: isManagerConfigured(),
    },
    {
      label: "Algebra Factory",
      address: CONTRACTS.factory,
      configured: true,
    },
    {
      label: "NonfungiblePositionManager",
      address: CONTRACTS.positionManager,
      configured: true,
    },
    ...VAULTS.map((vault) => ({
      label: vault.name,
      address: vault.address,
      configured: true,
    })),
    {
      label: "Keeper",
      address: "0xbDEf164B930F0b5E5011b5EafC2f1F1547Fb693E",
      configured: true,
    },
  ];

  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy address");
    }
  };

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.07] px-5 py-4">
        <p className="label mb-0">Contract addresses</p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.address}`}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white">{row.label}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-faint">
                {row.configured ? short(row.address) : "Not configured"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => copy(row.address)}
                disabled={!row.configured}
                className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted transition-colors hover:border-white/[0.18] hover:text-white disabled:opacity-30"
              >
                {copied === row.address ? "Copied" : "Copy"}
              </button>
              {row.configured && (
                <a
                  href={explorerAddress(row.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-brand/20 bg-brand/[0.07] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-brand-soft transition-colors hover:bg-brand/[0.12]"
                >
                  Explorer ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
