"use client";

import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { formatUnits, parseUnits } from "viem";
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  BERRY_ADDRESS,
  ERC20_ABI,
  STAKING_ABI,
  STAKING_ADDRESS,
} from "@/config";
import { useBuyBerryWithVolt } from "@/hooks/useBuyBerryWithVolt";

const BUY_LABELS: Record<string, string> = {
  idle: "",
  checking: "Проверка баланса VOLT…",
  "approving-volt": "Approving VOLT…",
  swapping: "Swapping VOLT to Berry…",
  "approving-berry": "Approving Berry…",
  depositing: "Depositing to Staking…",
  done: "Готово!",
  error: "Ошибка",
};

function formatAmount(value: bigint | undefined, digits = 4) {
  if (value === undefined) return "—";
  return Number(formatUnits(value, 18)).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

export default function StakeAdminPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rate, setRateInput] = useState("");
  const [voltAmount, setVoltAmount] = useState("");
  const [rateHash, setRateHash] = useState<Hash>();
  const [rateError, setRateError] = useState("");
  const [rateSuccess, setRateSuccess] = useState("");

  const { writeContractAsync, isPending } = useWriteContract();
  const rateReceipt = useWaitForTransactionReceipt({ hash: rateHash });
  const { buy, status, error, hash } = useBuyBerryWithVolt();

  const berryBalance = useReadContract({
    address: BERRY_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [STAKING_ADDRESS],
    query: { enabled: isAdmin, refetchInterval: 12_000 },
  });
  const rewardRate = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "rewardRatePerDay",
    query: { enabled: isAdmin, refetchInterval: 12_000 },
  });
  const totalStaked = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: isAdmin, refetchInterval: 12_000 },
  });

  useEffect(() => {
    if (!rateReceipt.isSuccess) return;
    void rewardRate.refetch();
    setRateSuccess("Ставка обновлена.");
    setRateError("");
    setRateInput("");
    setRateHash(undefined);
  }, [rateReceipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) return null;

  const submitRate = async () => {
    setRateError("");
    setRateSuccess("");
    try {
      const amount = parseUnits(rate.trim(), 18);
      if (amount <= 0n) throw new Error("Ставка должна быть больше нуля.");
      setRateHash(
        await writeContractAsync({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: "setRewardRate",
          args: [amount],
        }),
      );
    } catch (err) {
      setRateError(err instanceof Error ? err.message : String(err));
    }
  };

  const buyBerry = async () => {
    try {
      const amount = parseUnits(voltAmount.trim(), 18);
      if (amount <= 0n) throw new Error("Введите сумму VOLT.");
      await buy(amount);
    } catch (err) {
      // buy() handles tx errors; this catches parse errors.
      setRateError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section
      className="mt-8 rounded-2xl border border-brand/60 bg-[#111] p-4 md:p-6"
      style={{ borderColor: "#875cff" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-white">
            🔒 Admin Panel
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            only owner · staking rewards
          </p>
        </div>
        <span className="rounded-full border border-brand/25 bg-brand/[0.08] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-brand-soft">
          owner
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
          <p className="label mb-1">Berry in contract</p>
          <p className="font-mono text-sm text-white">
            {formatAmount(berryBalance.data, 6)} BERRY
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
          <p className="label mb-1">Current rate</p>
          <p className="font-mono text-sm text-white">
            {formatAmount(rewardRate.data, 4)} / day
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
          <p className="label mb-1">Total staked</p>
          <p className="font-mono text-sm text-white">
            {formatAmount(totalStaked.data, 4)} bbWFUSE
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-[11px] font-semibold text-white">
            Set Reward Rate
          </p>
          <p className="mt-1 text-[10px] leading-4 text-faint">
            Berry per day. Calls staking.setRewardRate(amount × 1e18).
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="field"
              inputMode="decimal"
              placeholder="1.5"
              value={rate}
              onChange={(event) => setRateInput(event.target.value)}
            />
            <button
              type="button"
              className="btn-primary shrink-0 px-4"
              onClick={submitRate}
              disabled={isPending || rateReceipt.isLoading || !rate.trim()}
            >
              {rateReceipt.isLoading ? "Sending…" : "Set Rate"}
            </button>
          </div>
          {rateError && (
            <p className="mt-2 text-[10px] leading-4 text-red-200">{rateError}</p>
          )}
          {rateSuccess && (
            <p className="mt-2 text-[10px] leading-4 text-emerald-200">
              {rateSuccess}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-[11px] font-semibold text-white">
            Buy Berry & Top Up
          </p>
          <p className="mt-1 text-[10px] leading-4 text-faint">
            VOLT → Berry via SwapRouter, then staking.topUpRewards.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="field"
              inputMode="decimal"
              placeholder="100"
              value={voltAmount}
              onChange={(event) => setVoltAmount(event.target.value)}
            />
            <button
              type="button"
              className="btn-primary shrink-0 px-4"
              onClick={buyBerry}
              disabled={status === "checking" || status === "approving-volt" || status === "swapping" || status === "approving-berry" || status === "depositing" || !voltAmount.trim()}
            >
              {status === "idle" || status === "done" || status === "error"
                ? "Buy Berry & Deposit"
                : "Working…"}
            </button>
          </div>
          {BUY_LABELS[status] && (
            <p className="mt-2 font-mono text-[10px] text-brand-soft">
              {BUY_LABELS[status]}
            </p>
          )}
          {error && (
            <p className="mt-2 text-[10px] leading-4 text-red-200">{error}</p>
          )}
          {hash && (
            <p className="mt-1 font-mono text-[8px] text-faint">
              tx: {hash.slice(0, 10)}…{hash.slice(-6)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
