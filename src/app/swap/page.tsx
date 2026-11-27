"use client";

import { useState } from "react";
import LimitOrderForm from "@/components/limit-order-form";
import MyOrdersList from "@/components/my-orders-list";
import { useProtocolData } from "@/hooks/useProtocolData";

type Tab = "create" | "orders" | "history";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "create", label: "Create Order" },
  { id: "orders", label: "My Orders" },
  { id: "history", label: "History" },
];

export default function SwapPage() {
  const [tab, setTab] = useState<Tab>("create");
  const { orders, refetch } = useProtocolData();

  const onCreated = () => {
    refetch();
    setTab("orders");
  };

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

      <div className="mt-8 flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
              tab === item.id
                ? "bg-white/[0.08] text-white"
                : "text-muted hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {tab === "create" && <LimitOrderForm onCreated={onCreated} />}

          {tab === "orders" && (
            <MyOrdersList orders={orders} onChanged={refetch} />
          )}

          {tab === "history" && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="font-display text-lg font-semibold text-white">
                History is coming soon
              </p>
              <p className="mx-auto mt-2 max-w-[360px] text-[11px] leading-5 text-muted">
                Executed orders are emitted as on-chain events. A static export
                cannot query an unbounded history without an indexer, so this
                tab will use a subgraph or Blockscout API next.
              </p>
            </div>
          )}
        </div>

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
