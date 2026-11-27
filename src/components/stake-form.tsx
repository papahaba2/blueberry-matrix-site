"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Hash } from "viem";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  BBWFUSE_ADDRESS,
  ERC20_ABI,
  STAKING_ABI,
  STAKING_ADDRESS,
  isStakingConfigured,
} from "@/config";
import { useUsdPrice } from "@/utils/priceFeed";

type Mode = "deposit" | "withdraw";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100_000 ? 1 : 2,
  }).format(value);
}

function formatAmount(value: bigint | undefined, digits = 4) {
  if (value === undefined) return "—";
  return Number(formatUnits(value, 18)).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

export default function StakeForm() {
  const { address: account, isConnected } = useAccount();
  const configured = isStakingConfigured();
  const enabled = configured && Boolean(account);

  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txHash, setTxHash] = useState<Hash>();
  const [txKind, setTxKind] = useState<
    "approve" | "deposit" | "withdraw" | "claim" | null
  >(null);

  const { price: wfusePrice } = useUsdPrice("WFUSE");

  const totalStakedRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: configured, refetchInterval: 12_000 },
  });
  const rewardRateRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "rewardRatePerDay",
    query: { enabled: configured, refetchInterval: 12_000 },
  });
  const maxSwapRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "maxSwapPerDay",
    query: { enabled: configured, refetchInterval: 12_000 },
  });
  const swappedRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "swappedThisDay",
    query: { enabled: configured, refetchInterval: 12_000 },
  });
  const stakedRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stakedBalance",
    args: account ? [account] : undefined,
    query: { enabled, refetchInterval: 12_000 },
  });
  const pendingRead = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "pendingRewards",
    args: account ? [account] : undefined,
    query: { enabled, refetchInterval: 12_000 },
  });

  const bbBalanceRead = useReadContract({
    address: BBWFUSE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(account), refetchInterval: 12_000 },
  });
  const bbAllowanceRead = useReadContract({
    address: BBWFUSE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: account ? [account, STAKING_ADDRESS] : undefined,
    query: { enabled: Boolean(account && configured) },
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const totalStaked = totalStakedRead.data ?? 0n;
  const staked = stakedRead.data ?? 0n;
  const pending = pendingRead.data ?? 0n;
  const bbBalance = bbBalanceRead.data ?? 0n;
  const bbAllowance = bbAllowanceRead.data ?? 0n;

  const amountIn = useMemo(() => {
    if (!amount.trim()) return null;
    try {
      const parsed = parseUnits(amount.trim(), 18);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [amount]);

  const approveAmount =
    amountIn === null ? null : amountIn + amountIn / 1000n + 1n;
  const approvalNeeded =
    mode === "deposit" &&
    approveAmount !== null &&
    bbAllowance < approveAmount;

  const tvlUsd =
    wfusePrice !== null
      ? (Number(totalStaked) / 1e18) * wfusePrice
      : null;

  const available = mode === "deposit" ? bbBalance : staked;

  const validationError = useMemo(() => {
    if (!configured) {
      return "Staking не настроен: NEXT_PUBLIC_STAKING_ADDRESS пуст.";
    }
    if (!isConnected || !account) return "Подключите кошелёк.";
    if (!amountIn) return "Введите сумму bbWFUSE.";
    if (mode === "deposit" && amountIn > bbBalance) {
      return "Недостаточно bbWFUSE. Получи его на /vault.";
    }
    if (mode === "withdraw" && amountIn > staked) {
      return "Сумма больше вашего стейка.";
    }
    return "";
  }, [account, amountIn, bbBalance, configured, isConnected, mode, staked]);

  const refetchAll = () => {
    void totalStakedRead.refetch();
    void rewardRateRead.refetch();
    void maxSwapRead.refetch();
    void swappedRead.refetch();
    void stakedRead.refetch();
    void pendingRead.refetch();
    void bbBalanceRead.refetch();
    void bbAllowanceRead.refetch();
  };

  useEffect(() => {
    if (receipt.isSuccess) {
      refetchAll();
      setSuccess(
        txKind === "approve"
          ? "Approve bbWFUSE подтверждён."
          : txKind === "claim"
            ? "Berry получены."
            : txKind === "deposit"
              ? "bbWFUSE задепозирован."
              : "bbWFUSE возвращён, Berry заклеймлены.",
      );
      setError("");
      if (txKind !== "approve" && txKind !== "claim") setAmount("");
      setTxHash(undefined);
      setTxKind(null);
    }
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async () => {
    if (!approveAmount) return;
    setError("");
    setSuccess("");
    try {
      setTxKind("approve");
      setTxHash(
        await writeContractAsync({
          address: BBWFUSE_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [STAKING_ADDRESS, approveAmount],
        }),
      );
    } catch (err) {
      setTxKind(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submit = async () => {
    if (!amountIn || validationError) return;
    setError("");
    setSuccess("");
    try {
      setTxKind(mode);
      setTxHash(
        await writeContractAsync({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: mode === "deposit" ? "deposit" : "withdraw",
          args: [amountIn],
        }),
      );
    } catch (err) {
      setTxKind(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const claim = async () => {
    setError("");
    setSuccess("");
    try {
      setTxKind("claim");
      setTxHash(
        await writeContractAsync({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: "claimRewards",
        }),
      );
    } catch (err) {
      setTxKind(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = isPending || receipt.isLoading;
  const actionLabel = busy
    ? "Подтверждение…"
    : approvalNeeded
      ? "Approve bbWFUSE"
      : mode === "deposit"
        ? "Deposit bbWFUSE"
        : "Withdraw bbWFUSE";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-4">
          <p className="label mb-0">Total Staked</p>
          <p className="mt-3 font-mono text-2xl text-white">
            {formatAmount(totalStaked)} bbWFUSE
          </p>
          <p className="mt-1 font-mono text-[9px] text-faint">
            {tvlUsd === null ? "TVL: —" : `TVL: ${formatUsd(tvlUsd)}`}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="label mb-0">My Stake</p>
          <p className="mt-3 font-mono text-2xl text-white">
            {formatAmount(staked)} bbWFUSE
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="label mb-0">Pending Berry</p>
          <p className="mt-3 font-mono text-2xl text-brand-soft">
            {formatAmount(pending, 6)} BERRY
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="label mb-0">Reward Rate</p>
          <p className="mt-3 font-mono text-2xl text-white">
            {formatAmount(rewardRateRead.data)} / day
          </p>
          <p className="mt-1 font-mono text-[9px] text-faint">
            swap {formatAmount(swappedRead.data, 2)} /{" "}
            {formatAmount(maxSwapRead.data, 2)} WFUSE
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="glass rounded-2xl p-4 md:p-6">
          <div className="flex rounded-xl border border-white/[0.08] p-1">
            {(["deposit", "withdraw"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setAmount("");
                  setError("");
                  setSuccess("");
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold ${
                  mode === item
                    ? "bg-brand/20 text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {item === "deposit" ? "Deposit" : "Withdraw"}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="label mb-2">Amount (bbWFUSE)</label>
              <button
                type="button"
                className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted hover:text-white disabled:opacity-30"
                disabled={available === 0n}
                onClick={() => setAmount(formatUnits(available, 18))}
              >
                Max
              </button>
            </div>
            <div className="relative">
              <input
                className="field pr-28"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">
                bbWFUSE
              </span>
            </div>
            <p className="mt-2 font-mono text-[9px] text-faint">
              {mode === "deposit" ? "Wallet" : "Staked"}:{" "}
              {formatAmount(available)} bbWFUSE
            </p>
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

          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={busy || Boolean(validationError)}
            onClick={() => (approvalNeeded ? approve() : submit())}
          >
            {actionLabel}
          </button>

          <button
            type="button"
            className="mt-2 w-full rounded-xl border border-white/[0.1] px-3 py-2 text-[11px] font-semibold text-muted hover:text-white disabled:opacity-30"
            disabled={busy || pending === 0n}
            onClick={claim}
          >
            Claim Berry
          </button>
        </div>

        <div className="glass rounded-2xl p-4 md:p-6">
          <p className="label">How it works</p>
          <ul className="mt-3 space-y-3 text-[11px] leading-5 text-muted">
            <li>Stake the existing bbWFUSE receipt token; it is not minted here.</li>
            <li>Berry accrues every block based on the daily reward rate.</li>
            <li>Withdraw returns bbWFUSE and auto-claims pending Berry.</li>
            <li>Rewards are funded by top-ups and optional WFUSE → Berry swaps.</li>
          </ul>

          <Link
            href="/vault"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-brand/25 bg-brand/[0.07] px-3 py-2 text-[11px] font-semibold text-brand-soft transition-colors hover:bg-brand/[0.12]"
          >
            Get bbWFUSE →
          </Link>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              TVL
            </p>
            <p className="mt-1 font-mono text-sm text-white">
              {tvlUsd === null ? "—" : formatUsd(tvlUsd)}
            </p>
            <p className="mt-1 font-mono text-[8px] text-faint">
              totalStaked × WFUSE price
            </p>
          </div>

          {!configured && (
            <p className="mt-4 text-[10px] leading-4 text-amber-200">
              Staking ещё не задеплоен. Укажи NEXT_PUBLIC_STAKING_ADDRESS.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
