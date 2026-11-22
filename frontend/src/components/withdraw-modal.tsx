"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import { VAULT_ABI, type VaultConfig } from "@/config";

const SHARE_DECIMALS = 18;

type Props = {
  vault: VaultConfig;
  shares: bigint;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function WithdrawModal({
  vault,
  shares,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { address: account } = useAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<`0x${string}`>();

  const parsed = useMemo(() => {
    if (!amount.trim()) return null;
    try {
      const value = parseUnits(amount.trim(), SHARE_DECIMALS);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount]);

  const assetsRead = useReadContract({
    address: vault.address,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: parsed ? [parsed] : undefined,
    query: { enabled: Boolean(parsed && open) },
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) {
      toast.success(`Withdrawn from ${vault.name}`);
      setAmount("");
      onSuccess();
      onClose();
    }
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const canSubmit =
    Boolean(account) &&
    parsed !== null &&
    parsed <= shares &&
    !isPending &&
    !receipt.isLoading;

  const redeem = async () => {
    if (!parsed || !account) return;
    setError("");
    try {
      const txHash = await writeContractAsync({
        address: vault.address,
        abi: VAULT_ABI,
        functionName: "redeem",
        args: [parsed, account, account],
      });
      setHash(txHash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("User rejected")
          ? "Транзакция отклонена в кошельке."
          : "Не удалось выполнить withdraw.",
      );
    }
  };

  const assetsOut = assetsRead.data ?? 0n;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="glass w-full max-w-md rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label mb-0">Withdraw</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-white">
              {vault.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.1] px-2 py-1 text-sm text-muted hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Shares</label>
            <button
              type="button"
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted hover:text-white"
              onClick={() => setAmount(formatUnits(shares, SHARE_DECIMALS))}
            >
              Max
            </button>
          </div>
          <div className="relative mt-2">
            <input
              className="field pr-24"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">
              {vault.shareSymbol}
            </span>
          </div>
          <p className="mt-2 font-mono text-[9px] text-faint">
            Available: {formatUnits(shares, SHARE_DECIMALS)} {vault.shareSymbol}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">You will receive</span>
            <span className="font-mono text-white">
              ~{formatUnits(assetsOut, vault.asset.decimals)}{" "}
              {vault.asset.symbol}
            </span>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[11px] text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn-primary mt-5 w-full"
          onClick={redeem}
          disabled={!canSubmit}
        >
          {receipt.isLoading ? "Withdrawing..." : "Withdraw"}
        </button>
      </div>
    </div>
  );
}
