export default function GovernancePage() {
  return (
    <div className="page-shell py-10 md:py-16">
      <div className="eyebrow flex items-center gap-3">
        <span className="h-px w-8 bg-brand/70" />
        Governance · BERRY
      </div>
      <h1 className="mt-5 max-w-[760px] font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
        Owned by the
        <br />
        <span className="text-brand-soft">people building.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[13px] leading-6 text-muted">
        BERRY is the fixed-supply governance token of Blueberry Matrix. The
        on-chain proposal flow is in preparation; this page will host active
        proposals and voting once governance goes live.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          ["Supply", "20,000 BERRY"],
          ["Status", "In preparation"],
          ["Chain", "Fuse Mainnet"],
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-2xl p-5">
            <p className="label">{label}</p>
            <p className="mt-3 font-display text-xl font-semibold text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-brand-soft">
          Coming next
        </p>
        <p className="mt-3 max-w-[620px] text-[12px] leading-5 text-muted">
          Proposal creation, voting and execution will be added as the
          governance module ships. No off-chain voting is presented as
          on-chain governance.
        </p>
      </div>
    </div>
  );
}
