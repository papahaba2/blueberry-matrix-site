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
import {
  CONTRACTS,
  ERC20_ABI,
  FACTORY_ABI,
  LIMIT_ORDER_MANAGER_ABI,
  PAIRS,
  POOL_ABI,
  ZERO_ADDRESS,
  isManagerConfigured,
  sortTokens,
} from "@/config";

type RangeState = "loading" | "invalid" | "in-range" | "above" | "below";

function mapContractError(error: unknown, token0: string, token1: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("Order must be created out-of-range")) {
    return "Диапазон ордера должен быть выше или ниже текущей цены.";
  }
  if (raw.includes("tokenIn must be token0")) {
    return `Для выбранного диапазона необходимо вносить ${token0}.`;
  }
  if (raw.includes("tokenIn must be token1")) {
    return `Для выбранного диапазона необходимо вносить ${token1}.`;
  }
  if (raw.includes("tokenOut must be token0")) {
    return `Для выбранного диапазона выход должен быть в ${token0}.`;
  }
  if (raw.includes("tokenOut must be token1")) {
    return `Для выбранного диапазона выход должен быть в ${token1}.`;
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

  const [pairId, setPairId] = useState(PAIRS[0].id);
  const [tickLower, setTickLower] = useState("");
  const [tickUpper, setTickUpper] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [approveHash, setApproveHash] = useState<Hash>();
  const [createHash, setCreateHash] = useState<Hash>();

  const pair = PAIRS.find((item) => item.id === pairId) ?? PAIRS[0];
  const [token0, token1] = useMemo(
    () => sortTokens(pair.a, pair.b),
    [pair],
  );

  const poolRead = useReadContract({
    address: CONTRACTS.factory,
    abi: FACTORY_ABI,
    functionName: "poolByPair",
    args: [token0.address, token1.address],
    query: { enabled: isConnected },
  });

  const poolAddress =
    poolRead.data && poolRead.data !== ZERO_ADDRESS
      ? (poolRead.data as Address)
      : undefined;

  const stateRead = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "globalState",
    query: { enabled: Boolean(poolAddress) },
  });

  const currentTick =
    stateRead.data && typeof stateRead.data[1] === "number"
      ? stateRead.data[1]
      : undefined;

  const lower = Number.parseInt(tickLower, 10);
  const upper = Number.parseInt(tickUpper, 10);
  const ticksValid =
    Number.isFinite(lower) && Number.isFinite(upper) && lower < upper;

  const rangeState: RangeState = !ticksValid
    ? "invalid"
    : currentTick === undefined
      ? "loading"
      : lower <= currentTick && currentTick <= upper
        ? "in-range"
        : lower > currentTick
          ? "above"
          : "below";

  // Strict contract rule: above current tick => deposit token0;
  // below current tick => deposit token1.
  const tokenIn =
    rangeState === "above" ? token0 : rangeState === "below" ? token1 : undefined;
  const tokenOut =
    rangeState === "above" ? token1 : rangeState === "below" ? token0 : undefined;

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
    args:
      account && tokenIn
        ? [account, CONTRACTS.limitOrderManager]
        : undefined,
    query: { enabled: Boolean(tokenIn && account) },
  });

  const balance = balanceRead.data ?? 0n;
  const allowance = allowanceRead.data ?? 0n;
  const needsApproval = amountIn !== null && allowance < amountIn;

  const expectedOut = useMemo(() => {
    if (!amountIn || !tokenIn || !tokenOut) return null;
    if (!tokenIn.priceUsd || !tokenOut.priceUsd) return null;
    const input = Number(formatUnits(amountIn, tokenIn.decimals));
    const output = (input * tokenIn.priceUsd) / tokenOut.priceUsd;
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
    // The refetch function is stable; the receipt flag is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt.isSuccess]);

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
    if (poolRead.isLoading || stateRead.isLoading) {
      return "Загружаем текущую цену пула...";
    }
    if (!poolAddress) {
      return "Пул для этой пары не найден на Fuse.";
    }
    if (currentTick === undefined) {
      return "Не удалось прочитать currentTick пула.";
    }
    if (!ticksValid) {
      return "Нижний тик должен быть меньше верхнего.";
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
    isConnected,
    poolAddress,
    poolRead.isLoading,
    rangeState,
    stateRead.isLoading,
    ticksValid,
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
      setError(mapContractError(err, token0.symbol, token1.symbol));
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
        args: [
          tokenIn.address,
          tokenOut.address,
          amountIn,
          lower,
          upper,
        ],
      });
      setCreateHash(hash);
    } catch (err) {
      setError(mapContractError(err, token0.symbol, token1.symbol));
    }
  };

  const busy = isPending || approveReceipt.isLoading || createReceipt.isLoading;
  const submitDisabled = Boolean(validationError) || busy;
  const hint =
    rangeState === "above"
      ? `Для этого диапазона вы должны внести ${token0.symbol}`
      : rangeState === "below"
        ? `Для этого диапазона вы должны внести ${token1.symbol}`
        : "";

  return (
    <div className="glass rounded-2xl p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Pair</label>
          <select
            className="field"
            value={pairId}
            onChange={(event) => {
              setPairId(event.target.value);
              setTickLower("");
              setTickUpper("");
              setAmount("");
              setError("");
              setSuccess("");
            }}
          >
            {PAIRS.map((item) => (
              <option key={item.id} value={item.id} className="bg-ink">
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Current tick</label>
          <div className="field flex items-center justify-between text-muted">
            <span>{currentTick ?? "—"}</span>
            <span className="text-[9px] uppercase tracking-[0.16em]">
              {poolAddress ? "pool live" : "no pool"}
            </span>
          </div>
        </div>

        <div>
          <label className="label">Tick lower</label>
          <input
            className="field"
            inputMode="numeric"
            placeholder="например -120000"
            value={tickLower}
            onChange={(event) => setTickLower(event.target.value)}
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
          />
        </div>
      </div>

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
            className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted hover:text-white"
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
            disabled={busy || Boolean(validationError)}
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
