import Link from "next/link";
import HeroVisual from "@/components/hero-visual";

const STATS = [
  { label: "Vault TVL", value: "Live", note: "WFUSE + USDC" },
  { label: "Venue", value: "Algebra V4", note: "Fuse Mainnet" },
  { label: "Order type", value: "Single-sided", note: "Out-of-range only" },
  { label: "Custody", value: "Non-custodial", note: "Wallet-signed" },
];

export default function HomePage() {
  return (
    <div className="relative">
      <section className="relative isolate flex min-h-[calc(100svh-6rem)] items-end overflow-hidden pb-12 pt-20">
        <HeroVisual />
        <div className="page-shell relative z-10">
          <div className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-brand/70" />
            Fuse Mainnet · DeFi × Governance
          </div>

          <h1 className="mt-6 max-w-[1050px] font-display text-[clamp(3.2rem,9vw,8rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-white">
            Blueberry
            <br />
            <span className="text-brand-soft">Matrix.</span>
          </h1>

          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-[520px]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-soft">
                The Voice of the Streets on Fuse
              </p>
              <p className="mt-4 text-[13px] leading-6 text-muted">
                A transparent yield vault, an Algebra-powered limit order
                engine, a live network radar and a governance layer for the
                people building on Fuse.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/swap" className="btn-primary">
                Place a limit order ↗
              </Link>
              <Link href="/vault" className="btn-ghost">
                Explore vaults
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-5 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="py-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-faint">
                  {stat.label}
                </p>
                <p className="mt-2 font-display text-lg font-semibold tracking-[-0.04em] text-white md:text-2xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-[10px] text-faint">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell grid gap-4 py-16 md:grid-cols-3">
        {[
          {
            title: "Strictly out-of-range",
            body: "Every limit order is one-sided. No internal swap, no swap slippage, no MEV surface.",
          },
          {
            title: "Wallet-native",
            body: "Connect any EVM wallet, approve one token and create the position in a single flow.",
          },
          {
            title: "On-chain execution",
            body: "A keeper closes the position only after price crosses your target range.",
          },
        ].map((item) => (
          <article key={item.title} className="glass rounded-2xl p-5">
            <div className="mb-8 h-8 w-8 rounded-lg border border-brand/30 bg-brand/10" />
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-white">
              {item.title}
            </h2>
            <p className="mt-3 text-[12px] leading-5 text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
