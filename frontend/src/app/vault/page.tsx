import Link from "next/link";
import { TOKENS } from "@/config";

const VAULTS = [
  {
    name: "WFUSE Vault",
    asset: TOKENS.WFUSE,
    description: "UUPS ERC-4626 vault with keeper-driven strategy rotation.",
  },
  {
    name: "USDC Vault",
    asset: TOKENS.USDC,
    description: "Dedicated USDC vault with its own ERC-4626 proxy and lending strategy.",
  },
];

export default function VaultPage() {
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
        Vault deposits stay non-custodial. The keeper rotates capital between
        approved Fuse strategies while every position remains visible on-chain.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {VAULTS.map((vault, index) => (
          <article key={vault.name} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label">Vault 0{index + 1}</p>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-white">
                  {vault.name}
                </h2>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-200">
                Live
              </span>
            </div>

            <p className="mt-4 text-[12px] leading-5 text-muted">
              {vault.description}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4">
              <div>
                <p className="label">Asset</p>
                <p className="font-mono text-sm text-white">{vault.asset.symbol}</p>
              </div>
              <div>
                <p className="label">TVL</p>
                <p className="font-mono text-sm text-faint">Read on-chain →</p>
              </div>
            </div>

            <Link
              href="/swap"
              className="mt-5 inline-flex text-[11px] font-semibold text-brand-soft hover:text-white"
            >
              Place a limit order instead ↗
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
