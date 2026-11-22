import ContractAddresses from "@/components/contract-addresses";
import NetworkStats from "@/components/network-stats";
import { EXPLORER_URL, TOKENS, explorerToken } from "@/config";

export default function NetworkPage() {
  return (
    <div className="page-shell py-10 md:py-16">
      <div className="eyebrow flex items-center gap-3">
        <span className="h-px w-8 bg-brand/70" />
        Network · Fuse Mainnet
      </div>
      <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
        Verifiable
        <br />
        <span className="text-brand-soft">by default.</span>
      </h1>
      <p className="mt-5 max-w-[540px] text-[13px] leading-6 text-muted">
        Live protocol data, every contract address and the tokens used by the
        interface. Everything is read directly from Fuse Mainnet.
      </p>

      <div className="mt-9">
        <NetworkStats />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ContractAddresses />

        <section className="glass rounded-2xl p-5">
          <p className="label">Tokens</p>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {Object.values(TOKENS).map((token) => (
              <div
                key={token.symbol}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{token.symbol}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-faint">
                    {token.address}
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-faint">
                    {token.decimals} decimals
                  </p>
                </div>
                <a
                  href={explorerToken(token.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[10px] text-brand-soft hover:text-white"
                >
                  Explorer ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={EXPLORER_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost"
        >
          Fuse Blockscout ↗
        </a>
      </div>
    </div>
  );
}
