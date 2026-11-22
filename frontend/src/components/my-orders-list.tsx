"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import {
  CONTRACTS,
  LIMIT_ORDER_MANAGER_ABI,
  isManagerConfigured,
  tokenByAddress,
  type Token,
} from "@/config";
import type { ProtocolOrder } from "@/hooks/useProtocolData";

function tokenSymbol(address: `0x${string}`): string {
  const token: Token | undefined = tokenByAddress(address);
  return token?.symbol ?? `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function tokenDecimals(address: `0x${string}`): number {
  return tokenByAddress(address)?.decimals ?? 18;
}

export default function MyOrdersList({
  orders,
  onChanged,
}: {
  orders: ProtocolOrder[];
  onChanged: () => void;
}) {
  const { address: account, isConnected } = useAccount();
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [hash, setHash] = useState<`0x${string}`>();
  const { writeContractAsync, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const mine = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            account &&
            order.owner.toLowerCase() === account.toLowerCase(),
        )
        .sort((a, b) => b.orderId - a.orderId),
    [account, orders],
  );

  useEffect(() => {
    if (receipt.isSuccess) {
      toast.success("Order cancelled");
      setCancelId(null);
      setHash(undefined);
      onChanged();
    }
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isManagerConfigured()) {
    return (
      <div className="glass rounded-2xl p-5 text-[12px] text-muted">
        V4LimitOrderManager не настроен. Добавь адрес в переменную окружения.
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="glass rounded-2xl p-5 text-[12px] text-muted">
        Подключи кошелёк, чтобы увидеть свои активные ордера.
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="font-display text-lg font-semibold text-white">
          No active orders
        </p>
        <p className="mt-2 text-[11px] text-muted">
          Create a strict out-of-range limit order and it will appear here.
        </p>
      </div>
    );
  }

  const cancel = async (orderId: number) => {
    setCancelId(orderId);
    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.limitOrderManager,
        abi: LIMIT_ORDER_MANAGER_ABI,
        functionName: "cancelOrder",
        args: [BigInt(orderId)],
      });
      setHash(txHash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(
        message.includes("User rejected")
          ? "Транзакция отклонена"
          : "Не удалось отменить ордер",
      );
      setCancelId(null);
    }
  };

  return (
    <div className="space-y-3">
      {mine.map((order) => {
        const inSymbol = tokenSymbol(order.tokenIn);
        const outSymbol = tokenSymbol(order.tokenOut);
        const amount = formatUnits(order.amountIn, tokenDecimals(order.tokenIn));

        return (
          <article key={order.orderId} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                  Order #{order.orderId}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  {inSymbol} → {outSymbol}
                </h3>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] ${
                  order.canExecute
                    ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
                    : "border-brand/20 bg-brand/[0.06] text-brand-soft"
                }`}
              >
                {order.canExecute ? "Ready to execute" : "Active"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3 sm:grid-cols-3">
              <div>
                <p className="label mb-1">Amount</p>
                <p className="font-mono text-[12px] text-white">
                  {Number(amount).toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {inSymbol}
                </p>
              </div>
              <div>
                <p className="label mb-1">Range</p>
                <p className="font-mono text-[11px] text-white">
                  {order.tickLower} → {order.tickUpper}
                </p>
              </div>
              <div>
                <p className="label mb-1">Token ID</p>
                <p className="font-mono text-[11px] text-white">
                  #{order.tokenId.toString()}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[11px] font-semibold text-red-200 transition-colors hover:bg-red-400/[0.1] disabled:opacity-40"
              disabled={isPending || cancelId === order.orderId}
              onClick={() => cancel(order.orderId)}
            >
              {cancelId === order.orderId && receipt.isLoading
                ? "Cancelling..."
                : "Cancel order"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
