import {
  CONTRACTS,
  EXPLORER_URL,
  TOKENS,
  explorerAddress,
  explorerToken,
  isManagerConfigured,
} from "@/config";

function shorten(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function NetworkPage() {
  const contracts = [
    ["Algebra Factory", CONTRACTS.factory],
    ["NonfungiblePositionManager", CONTRACTS.positionManager],
    [
      "V4LimitOrderManager",
      isManagerConfigured() ? CONTRACTS.limitOrderManager : "Not configured",
    ],
  ] as const;

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
      <p className="mt-5 max-w-[520px] text-[13px] leading-6 text-muted">
        Every contract address used by the interface is listed below. All links
        point directly to the Fuse Blockscout explorer.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="label mb-0">Deployed contracts</p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {contracts.map(([name, address]) => (
              <div
                key={name}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[12px] font-semibold text-white">{name}</p>
                  <p className="mt-1 font-mono text-[10px] text-faint">{address}</p>
                </div>
                {address.startsWith("0x") ? (
                  <a
                    href={explorerAddress(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-semibold text-brand-soft hover:text-white"
                  >
                    {shorten(address)} ↗
                  </a>
                ) : (
                  <span className="text-[10px] text-faint">Set env →</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <p className="label">Tokens</p>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {Object.values(TOKENS).map((token) => (
              <div key={token.symbol} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-sm text-white">{token.symbol}</p>
                  <p className="mt-1 font-mono text-[9px] text-faint">
                    {token.address}
                  </p>
                </div>
                <a
                  href={explorerToken(token.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-brand-soft hover:text-white"
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
