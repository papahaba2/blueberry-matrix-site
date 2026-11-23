"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import PairSearch from "@/components/pair-search";
import {
  CONTRACTS,
  ERC20_ABI,
  LIMIT_ORDER_MANAGER_ABI,
  POOL_ABI,
  ZERO_ADDRESS,
  isManagerConfigured,
  tokenByAddress,
} from "@/config";
import type { PoolInfo } from "@/utils/getAllPools";
import { poolFeeLabel } from "@/utils/getAllPools";

type RangeState = "empty" | "loading" | "invalid" | "in-range" | "above" | "below";

type TokenLeg = {
  address: Address;
  symbol: string;
  decimals: number;
};

function mapContractError(error: unknown, symbol0: string, symbol1: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("Order must be created out-of-range")) {
    return "Диапазон ордера должен быть выше или ниже текущей цены.";
  }
  if (raw.includes("tokenIn must be token0")) {
    return `Для выбранного диапазона необходимо вносить ${symbol0}.`;
  }
  if (raw.includes("tokenIn must be token1")) {
    return `Для выбранного диапазона необходимо вносить ${symbol1}.`;
  }
  if (raw.includes("not executable")) {
    return "Ордер ещё не достиг целевой цены.";
  }
  if (raw.includes("User rejected") || raw.includes("user rejected")) {
    return "Транзакция отклонена в кошельке.";
  }
  if (raw.includes("no pool")) {
    return "Для этой пары нет пула Algebra на Fuse.";
  }

  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

export default function LimitOrderForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const { address: account, isConnected } = useAccount();

  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [tickLower, setTickLower] = useState("");
  const [tickUpper, setTickUpper] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [approveHash, setApproveHash] = useState<Hash>();
  const [createHash, setCreateHash] = useState<Hash>();
  const [poolRefresh, setPoolRefresh] = useState(0);

  const token0 = useMemo<TokenLeg | null>(
    () =>
      pool
        ? {
            address: pool.token0 as Address,
            symbol: pool.symbol0,
            decimals: pool.decimals0,
          }
        : null,
    [pool],
  );
  const token1 = useMemo<TokenLeg | null>(
    () =>
      pool
        ? {
            address: pool.token1 as Address,
            symbol: pool.symbol1,
            decimals: pool.decimals1,
          }
        : null,
    [pool],
  );

  const stateRead = useReadContract({
    address: (pool?.poolAddress as Address | undefined) ?? undefined,
    abi: POOL_ABI,
    functionName: "globalState",
    query: { enabled: Boolean(pool) },
  });

  const currentTick =
    stateRead.data && typeof stateRead.data[1] === "number"
      ? stateRead.data[1]
      : undefined;
  const tickReadError =
    stateRead.error instanceof Error
      ? stateRead.error.message
      : stateRead.error
        ? String(stateRead.error)
        : "";

  useEffect(() => {
    if (!pool) return;
    console.log(
      "[pool]",
      pool.poolAddress,
      currentTick,
      pool.fee,
      pool.tickSpacing,
      tickReadError,
    );
  }, [currentTick, pool, tickReadError]);

  const currentPrice = useMemo(() => {
    if (!pool || currentTick === undefined) return null;
    const raw = 1.0001 ** currentTick;
    const decimals = pool.decimals0 - pool.decimals1;
    return raw * 10 ** decimals;
  }, [currentTick, pool]);

  const lower = Number.parseInt(tickLower, 10);
  const upper = Number.parseInt(tickUpper, 10);
  const integerTicks =
    /^-?\d+$/.test(tickLower.trim()) && /^-?\d+$/.test(tickUpper.trim());
  const ticksValid =
    integerTicks &&
    Number.isFinite(lower) &&
    Number.isFinite(upper) &&
    lower < upper;
  const tickSpacing = pool?.tickSpacing ?? 0;
  const spacingValid =
    tickSpacing > 0 &&
    Number.isFinite(lower) &&
    Number.isFinite(upper) &&
    lower % tickSpacing === 0 &&
    upper % tickSpacing === 0;
  const nearestLower =
    tickSpacing > 0 ? Math.round(lower / tickSpacing) * tickSpacing : 0;
  const nearestUpper =
    tickSpacing > 0 ? Math.round(upper / tickSpacing) * tickSpacing : 0;

  const rangeState: RangeState = !pool
    ? "empty"
    : !ticksValid
      ? "invalid"
      : currentTick === undefined
        ? "loading"
        : lower <= currentTick && currentTick <= upper
          ? "in-range"
          : lower > currentTick
            ? "above"
            : "below";

  // Strict contract rule: above current tick => token0, below => token1.
  const tokenIn =
    rangeState === "above" ? token0 : rangeState === "below" ? token1 : null;
  const tokenOut =
    rangeState === "above" ? token1 : rangeState === "below" ? token0 : null;

  const amountIn = useMemo(() => {
    if (!tokenIn || !amount.trim()) return null;
    try {
      const parsed = parseUnits(amount.trim(), tokenIn.decimals);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [amount, tokenIn]);

  const balanceRead = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(tokenIn && account) },
  });

  const allowanceRead = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: account && tokenIn ? [account, CONTRACTS.limitOrderManager] : undefined,
    query: { enabled: Boolean(tokenIn && account) },
  });

  const balance = balanceRead.data ?? 0n;
  const allowance = allowanceRead.data ?? 0n;
  const needsApproval = amountIn !== null && allowance < amountIn;

  const expectedOut = useMemo(() => {
    if (!amountIn || !tokenIn || !tokenOut) return null;
    const inPrice = tokenByAddress(tokenIn.address)?.priceUsd;
    const outPrice = tokenByAddress(tokenOut.address)?.priceUsd;
    if (!inPrice || !outPrice) return null;
    const input = Number(formatUnits(amountIn, tokenIn.decimals));
    const output = (input * inPrice) / outPrice;
    return Number.isFinite(output) && output > 0 ? output : null;
  }, [amountIn, tokenIn, tokenOut]);

  const { writeContractAsync, isPending } = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });
  const createReceipt = useWaitForTransactionReceipt({ hash: createHash });

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      void allowanceRead.refetch();
      setSuccess("Approval подтверждён. Теперь можно создать лимитный ордер.");
      setError("");
    }
  }, [approveReceipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (createReceipt.isSuccess) {
      setSuccess("Лимитный ордер создан. Keeper исполнит его после выхода цены из диапазона.");
      setError("");
      setAmount("");
      setCreateHash(undefined);
      onCreated?.();
    }
  }, [createReceipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const validationError = useMemo(() => {
    if (!isManagerConfigured()) {
      return "Адрес V4LimitOrderManager не настроен в NEXT_PUBLIC_LIMIT_ORDER_MANAGER_ADDRESS.";
    }
    if (!isConnected || !account) {
      return "Подключите кошелёк, чтобы создать лимитный ордер.";
    }
    if (!pool || !token0 || !token1) {
      return "Выберите пул из списка.";
    }
    if (pool.poolAddress === ZERO_ADDRESS) {
      return "Пул для этой пары не найден. Возможно, он ещё не создан.";
    }
    if (stateRead.isLoading) {
      return "Загружаем текущую цену пула...";
    }
    if (stateRead.error) {
      return `Не удалось прочитать пул ${pool.poolAddress}: ${tickReadError}`;
    }
    if (currentTick === undefined) {
      return "Не удалось прочитать currentTick пула.";
    }
    if (!integerTicks) {
      return "Тики должны быть целыми числами.";
    }
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
      return "Нижний тик должен быть меньше верхнего.";
    }
    if (!spacingValid) {
      return `Тики должны быть кратны tickSpacing ${tickSpacing}. Ближайшие значения: ${nearestLower} и ${nearestUpper}.`;
    }
    if (rangeState === "in-range") {
      return "Лимитный ордер должен быть вне текущего диапазона. Для входа по рыночной цене используйте обычный Swap.";
    }
    if (!tokenIn || !tokenOut) {
      return "Выберите диапазон выше или ниже текущей цены.";
    }
    if (!amountIn) {
      return `Введите сумму в ${tokenIn.symbol}.`;
    }
    if (amountIn > balance) {
      return `Недостаточно ${tokenIn.symbol} в кошельке.`;
    }
    return "";
  }, [
    account,
    amountIn,
    balance,
    currentTick,
    integerTicks,
    isConnected,
    nearestLower,
    nearestUpper,
    pool,
    rangeState,
    spacingValid,
    stateRead.isLoading,
    tickSpacing,
    tickReadError,
    ticksValid,
    token0,
    token1,
    tokenIn,
    tokenOut,
  ]);

  const approve = async () => {
    if (!tokenIn || !amountIn) return;
    setError("");
    setSuccess("");
    try {
      const hash = await writeContractAsync({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.limitOrderManager, amountIn],
      });
      setApproveHash(hash);
    } catch (err) {
      setError(mapContractError(err, token0?.symbol ?? "", token1?.symbol ?? ""));
    }
  };

  const createOrder = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !ticksValid) return;
    setError("");
    setSuccess("");
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.limitOrderManager,
        abi: LIMIT_ORDER_MANAGER_ABI,
        functionName: "createOrder",
        args: [tokenIn.address, tokenOut.address, amountIn, lower, upper],
      });
      setCreateHash(hash);
    } catch (err) {
      setError(mapContractError(err, token0?.symbol ?? "", token1?.symbol ?? ""));
    }
  };

  const busy = isPending || approveReceipt.isLoading || createReceipt.isLoading;
  // Explicitly tied to the selected pool + successfully decoded current tick.
  const submitDisabled =
    !pool ||
    currentTick === undefined ||
    Boolean(validationError) ||
    busy;
  const hint =
    rangeState === "above"
      ? `Для этого диапазона вы должны внести ${token0?.symbol}`
      : rangeState === "below"
        ? `Для этого диапазона вы должны внести ${token1?.symbol}`
        : "";

  return (
    <div className="glass rounded-2xl p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Pool</label>
            <button
              type="button"
              className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted hover:text-white"
              onClick={() => setPoolRefresh((value) => value + 1)}
            >
              Refresh pools
            </button>
          </div>
          <PairSearch
            refreshToken={poolRefresh}
            onSelect={(selected) => {
              setPool(selected);
              setTickLower("");
              setTickUpper("");
              setAmount("");
              setError("");
              setSuccess("");
            }}
          />
        </div>

        <div>
          <label className="label">Current tick / price</label>
          <div className="field flex items-center justify-between gap-3 text-muted">
            <span>
              {!pool
                ? "—"
                : stateRead.isLoading
                  ? "loading…"
                  : stateRead.error
                    ? "error"
                    : (currentTick ?? "—")}
            </span>
            <span className="truncate font-mono text-[10px] text-brand-soft">
              {!pool
                ? "select pool"
                : stateRead.isLoading
                  ? "loading"
                  : stateRead.error
                    ? "read failed"
                    : currentPrice !== null
                      ? `1 ${pool.symbol0} = ${currentPrice.toLocaleString("en-US", {
                          maximumSignificantDigits: 6,
                        })} ${pool.symbol1}`
                      : "—"}
            </span>
          </div>
          {pool && (
            <p className="mt-2 font-mono text-[9px] text-faint">
              fee {poolFeeLabel(pool.fee)} · tickSpacing {pool.tickSpacing}
            </p>
          )}
        </div>

        <div>
          <label className="label">Tick lower</label>
          <input
            className="field"
            inputMode="numeric"
            placeholder="например -120000"
            value={tickLower}
            onChange={(event) => setTickLower(event.target.value)}
            disabled={!pool}
          />
        </div>

        <div>
          <label className="label">Tick upper</label>
          <input
            className="field"
            inputMode="numeric"
            placeholder="например -60000"
            value={tickUpper}
            onChange={(event) => setTickUpper(event.target.value)}
            disabled={!pool}
          />
        </div>
      </div>

      {pool && (stateRead.error || (currentTick === undefined && !stateRead.isLoading)) && (
        <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[11px] leading-5 text-red-200">
          Не удалось прочитать пул {pool.poolAddress}:{" "}
          {tickReadError || "currentTick unavailable"}
        </p>
      )}

      {pool?.poolAddress === ZERO_ADDRESS && (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[11px] leading-5 text-amber-200">
          Пул для этой пары не найден. Возможно, он ещё не создан.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label mb-1">You deposit</p>
            <p className="font-display text-xl font-semibold text-white">
              {tokenIn?.symbol ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="label mb-1">You receive</p>
            <p className="font-mono text-sm text-brand-soft">
              {tokenOut?.symbol ?? "—"}
            </p>
          </div>
        </div>
        {hint && <p className="mt-3 text-[11px] text-muted">{hint}</p>}
        {expectedOut !== null && tokenOut && (
          <p className="mt-2 font-mono text-[10px] text-faint">
            Spot estimate: ~
            {expectedOut.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })}{" "}
            {tokenOut.symbol}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className="label mb-2">Amount</label>
          <button
            type="button"
            className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted hover:text-white disabled:opacity-30"
            onClick={() => {
              if (!tokenIn) return;
              setAmount(formatUnits(balance, tokenIn.decimals));
            }}
            disabled={!tokenIn || balance === 0n}
          >
            Max
          </button>
        </div>
        <div className="relative">
          <input
            className="field pr-20"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">
            {tokenIn?.symbol ?? "—"}
          </span>
        </div>
        {tokenIn && (
          <p className="mt-2 font-mono text-[9px] text-faint">
            Balance: {formatUnits(balance, tokenIn.decimals)} {tokenIn.symbol}
          </p>
        )}
      </div>

      {(error || validationError) && (
        <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[11px] leading-5 text-red-200">
          {error || validationError}
        </p>
      )}

      {success && (
        <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-[11px] leading-5 text-emerald-200">
          {success}
        </p>
      )}

      <div className="mt-5">
        {needsApproval ? (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={approve}
            disabled={submitDisabled}
          >
            {approveReceipt.isLoading
              ? "Approving..."
              : `Approve ${tokenIn?.symbol ?? ""}`}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={createOrder}
            disabled={submitDisabled}
          >
            {createReceipt.isLoading ? "Creating..." : "Create limit order"}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] leading-5 text-faint">
        Позиция создаётся только вне текущего диапазона. Контракт не выполняет
        внутренний swap.
      </p>
    </div>
  );
}
