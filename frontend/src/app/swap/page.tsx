import LimitOrderForm from "@/components/limit-order-form";

export default function SwapPage() {
  return (
    <div className="page-shell py-10 md:py-16">
      <div className="max-w-[760px]">
        <div className="eyebrow flex items-center gap-3">
          <span className="h-px w-8 bg-brand/70" />
          Limit orders · Algebra V4
        </div>
        <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
          Set the price.
          <br />
          <span className="text-brand-soft">Let the pool work.</span>
        </h1>
        <p className="mt-5 max-w-[560px] text-[13px] leading-6 text-muted">
          A limit order is a single-sided position created outside the current
          tick range. It never performs an internal swap, so there is no
          swap-slippage and no swap-MEV surface.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LimitOrderForm />
        <aside className="space-y-3">
          <div className="glass rounded-2xl p-4">
            <p className="label">Strict direction</p>
            <p className="text-[11px] leading-5 text-muted">
              Range above current tick → deposit token0. Range below current
              tick → deposit token1. An in-range range is rejected.
            </p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="label">Execution</p>
            <p className="text-[11px] leading-5 text-muted">
              The keeper closes the position after price crosses the entire
              range. Fees are charged in the output token when the order is
              executed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
