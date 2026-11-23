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
import {
  formatPrice,
  parsePrice,
  priceFromTick,
  rawTickFromPrice,
  roundToSpacing,
} from "@/utils/tickMath";

type RangeState = "empty" | "loading" | "invalid" | "in-range" | "above" | "below";
type Edge = "lower" | "upper";
type InputMode = "price" | "tick";

function priceInputValue(price: number): string {
  return Number(price.toPrecision(10)).toString();
}

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
  const [priceLower, setPriceLower] = useState("");
  const [priceUpper, setPriceUpper] = useState("");
  const [lowerMode, setLowerMode] = useState<InputMode>("price");
  const [upperMode, setUpperMode] = useState<InputMode>("price");
  const [activeEdge, setActiveEdge] = useState<Edge>("lower");
  const [roundingHint, setRoundingHint] = useState("");
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
    const price = priceFromTick(currentTick, pool.decimals0, pool.decimals1);
    return price > 0 ? price : null;
  }, [currentTick, pool]);

  const lower = Number.parseInt(tickLower, 10);
  const upper = Number.parseInt(tickUpper, 10);
  const integerTicks =
    /^-?\d+$/.test(tickLower.trim()) && /^-?\d+$/.test(tickUpper.trim());
  const tickSpacing = pool?.tickSpacing ?? 0;
  const ticksValid =
    integerTicks &&
    Number.isFinite(lower) &&
    Number.isFinite(upper) &&
    lower < upper;
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

  const setTickForEdge = (edge: Edge, value: string) => {
    setActiveEdge(edge);
    setLowerMode(edge === "lower" ? "tick" : lowerMode);
    setUpperMode(edge === "upper" ? "tick" : upperMode);

    if (edge === "lower") setTickLower(value);
    else setTickUpper(value);

    if (!pool || !/^-?\d+$/.test(value.trim())) {
      setRoundingHint("");
      return;
    }

    const tick = Number.parseInt(value, 10);
    const price = priceFromTick(tick, pool.decimals0, pool.decimals1);
    if (price > 0) {
      if (edge === "lower") setPriceLower(priceInputValue(price));
      else setPriceUpper(priceInputValue(price));
      setRoundingHint(`≈ ${formatPrice(price)} ${pool.symbol1}`);
    }
  };

  const setPriceForEdge = (edge: Edge, value: string) => {
    setActiveEdge(edge);
    setLowerMode(edge === "lower" ? "price" : lowerMode);
    setUpperMode(edge === "upper" ? "price" : upperMode);

    if (edge === "lower") setPriceLower(value);
    else setPriceUpper(value);

    if (!pool) return;
    const price = parsePrice(value);
    if (price === null) {
      setRoundingHint("");
      return;
    }

    try {
      const rawTick = rawTickFromPrice(price, pool.decimals0, pool.decimals1);
      const rounded = roundToSpacing(rawTick, pool.tickSpacing);
      if (edge === "lower") setTickLower(String(rounded));
      else setTickUpper(String(rounded));
      setRoundingHint(
        `≈ tick ${rounded}${rounded !== rawTick ? `, округлено до шага ${pool.tickSpacing}` : ""}`,
      );
    } catch {
      setRoundingHint("Введите положительную цену.");
    }
  };

  const switchMode = (edge: Edge, mode: InputMode) => {
    setActiveEdge(edge);
    if (edge === "lower") setLowerMode(mode);
    else setUpperMode(mode);

    const tickText = edge === "lower" ? tickLower : tickUpper;
    const priceText = edge === "lower" ? priceLower : priceUpper;

    if (!pool) return;

    if (mode === "price" && tickText.trim() && priceText.trim() === "") {
      const tick = Number.parseInt(tickText, 10);
      if (Number.isFinite(tick)) {
        const price = priceFromTick(tick, pool.decimals0, pool.decimals1);
        if (price > 0) {
          if (edge === "lower") setPriceLower(priceInputValue(price));
          else setPriceUpper(priceInputValue(price));
        }
      }
    }

    if (mode === "tick" && priceText.trim()) {
      const price = parsePrice(priceText);
      if (price !== null) {
        try {
          const tick = roundToSpacing(
            rawTickFromPrice(price, pool.decimals0, pool.decimals1),
            pool.tickSpacing,
          );
          if (edge === "lower") setTickLower(String(tick));
          else setTickUpper(String(tick));
        } catch {
          // Keep the invalid value and let validation explain.
        }
      }
    }
  };

  const applyPreset = (percent: number) => {
    if (!currentPrice) return;
    const target = currentPrice * (1 + percent / 100);
    if (!Number.isFinite(target) || target <= 0) return;
    const edge = activeEdge;
    setPriceForEdge(edge, target.toPrecision(10));
  };

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
    if (!tickLower.trim() || !tickUpper.trim()) {
      return "Введите цену или тик для обеих границ.";
    }
    if (!integerTicks) {
      return "Тики должны быть целыми числами.";
    }
    if (lower === upper) {
      return "Диапазон слишком узкий: после округления границы совпали.";
    }
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
      return "Нижняя граница должна быть меньше верхней.";
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
    lower,
    nearestLower,
    nearestUpper,
    pool,
    rangeState,
    spacingValid,
    stateRead.error,
    stateRead.isLoading,
    tickLower,
    tickReadError,
    tickSpacing,
    tickUpper,
    token0,
    token1,
    tokenIn,
    tokenOut,
    upper,
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
  const submitDisabled =
    !pool || currentTick === undefined || Boolean(validationError) || busy;
  const hint =
    rangeState === "above"
      ? `Выше текущей цены → депозит ${token0?.symbol}`
      : rangeState === "below"
        ? `Ниже текущей цены → депозит ${token1?.symbol}`
        : "";

  const pricePlaceholder = pool
    ? `1 ${pool.symbol0} = … ${pool.symbol1}`
    : "1 TOKEN0 = … TOKEN1";

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
              setPriceLower("");
              setPriceUpper("");
              setLowerMode("price");
              setUpperMode("price");
              setActiveEdge("lower");
              setRoundingHint("");
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
                      ? `текущая: ${formatPrice(currentPrice)} ${pool.symbol1}`
                      : "—"}
            </span>
          </div>
          {pool && (
            <p className="mt-2 font-mono text-[9px] text-faint">
              fee {poolFeeLabel(pool.fee)} · tickSpacing {pool.tickSpacing}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["lower", "upper"] as Edge[]).map((edge) => {
          const mode = edge === "lower" ? lowerMode : upperMode;
          const tickValue = edge === "lower" ? tickLower : tickUpper;
          const priceValue = edge === "lower" ? priceLower : priceUpper;
          const edgeActive = activeEdge === edge;
          const label = edge === "lower" ? "LOWER" : "UPPER";

          return (
            <div
              key={edge}
              className={`rounded-xl border p-3 transition-colors ${
                edgeActive
                  ? "border-brand/40 bg-brand/[0.04]"
                  : "border-white/[0.08] bg-black/10"
              }`}
              onFocus={() => setActiveEdge(edge)}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="label mb-0">{label}</label>
                <div className="flex rounded-lg border border-white/[0.08] p-0.5">
                  {(["price", "tick"] as InputMode[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => switchMode(edge, item)}
                      className={`rounded-md px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${
                        mode === item
                          ? "bg-white/[0.08] text-white"
                          : "text-faint hover:text-white"
                      }`}
                    >
                      {item === "price" ? "Цена" : "Tick"}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "price" ? (
                <input
                  className="field mt-3"
                  inputMode="decimal"
                  placeholder={pricePlaceholder}
                  value={priceValue}
                  onFocus={() => setActiveEdge(edge)}
                  onChange={(event) => setPriceForEdge(edge, event.target.value)}
                  disabled={!pool}
                />
              ) : (
                <input
                  className="field mt-3"
                  inputMode="numeric"
                  placeholder={edge === "lower" ? "-120000" : "-60000"}
                  value={tickValue}
                  onFocus={() => setActiveEdge(edge)}
                  onChange={(event) => setTickForEdge(edge, event.target.value)}
                  disabled={!pool}
                />
              )}

              <p className="mt-2 font-mono text-[9px] text-faint">
                {mode === "price"
                  ? tickValue
                    ? `tick ${tickValue}`
                    : "—"
                  : priceValue
                    ? `${formatPrice(parsePrice(priceValue) ?? 0)} ${pool?.symbol1 ?? ""}`
                    : "—"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="label">Пресеты для активной границы ({activeEdge.toUpperCase()})</p>
        <div className="flex flex-wrap gap-1.5">
          {[-10, -5, -1, 0, 1, 5, 10].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => applyPreset(percent)}
              disabled={!currentPrice}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[9px] text-muted transition-colors hover:border-brand/30 hover:text-white disabled:opacity-30"
            >
              {percent === 0 ? "текущая" : `${percent > 0 ? "+" : ""}${percent}%`}
            </button>
          ))}
        </div>
        {roundingHint && (
          <p className="mt-2 font-mono text-[9px] text-brand-soft">{roundingHint}</p>
        )}
        {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
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
