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
import { ERC20_ABI, VAULT_ABI, type VaultConfig } from "@/config";

type Props = {
  vault: VaultConfig;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function DepositModal({ vault, open, onClose, onSuccess }: Props) {
  const { address: account } = useAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [approveHash, setApproveHash] = useState<`0x${string}`>();
  const [depositHash, setDepositHash] = useState<`0x${string}`>();

  const parsed = useMemo(() => {
    if (!amount.trim()) return null;
    try {
      const value = parseUnits(amount.trim(), vault.asset.decimals);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount, vault.asset.decimals]);

  const balanceRead = useReadContract({
    address: vault.asset.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(account && open) },
  });

  const allowanceRead = useReadContract({
    address: vault.asset.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: account ? [account, vault.address] : undefined,
    query: { enabled: Boolean(account && open) },
  });

  const sharesPreview = useReadContract({
    address: vault.address,
    abi: VAULT_ABI,
    functionName: "convertToShares",
    args: parsed ? [parsed] : undefined,
    query: { enabled: Boolean(parsed && open) },
  });

  const balance = balanceRead.data ?? 0n;
  const allowance = allowanceRead.data ?? 0n;
  const needsApproval = parsed !== null && allowance < parsed;

  const { writeContractAsync, isPending } = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });
  const depositReceipt = useWaitForTransactionReceipt({ hash: depositHash });

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      void allowanceRead.refetch();
      toast.success("Approval confirmed");
    }
  }, [approveReceipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (depositReceipt.isSuccess) {
      toast.success(`Deposited into ${vault.name}`);
      setAmount("");
      onSuccess();
      onClose();
    }
  }, [depositReceipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const canSubmit =
    Boolean(account) &&
    parsed !== null &&
    parsed <= balance &&
    !isPending &&
    !approveReceipt.isLoading &&
    !depositReceipt.isLoading;

  const approve = async () => {
    if (!parsed || !account) return;
    setError("");
    try {
      const hash = await writeContractAsync({
        address: vault.asset.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vault.address, parsed],
      });
      setApproveHash(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("User rejected")
          ? "Транзакция отклонена в кошельке."
          : "Не удалось подтвердить approve.",
      );
    }
  };

  const deposit = async () => {
    if (!parsed || !account) return;
    setError("");
    try {
      const hash = await writeContractAsync({
        address: vault.address,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [parsed, account],
      });
      setDepositHash(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("User rejected")
          ? "Транзакция отклонена в кошельке."
          : "Не удалось выполнить deposit.",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="glass w-full max-w-md rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label mb-0">Deposit</p>
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
            <label className="label mb-0">Amount</label>
            <button
              type="button"
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted hover:text-white"
              onClick={() =>
                setAmount(formatUnits(balance, vault.asset.decimals))
              }
            >
              Max
            </button>
          </div>
          <div className="relative mt-2">
            <input
              className="field pr-20"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">
              {vault.asset.symbol}
            </span>
          </div>
          <p className="mt-2 font-mono text-[9px] text-faint">
            Balance: {formatUnits(balance, vault.asset.decimals)}{" "}
            {vault.asset.symbol}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">You will receive</span>
            <span className="font-mono text-white">
              ~{formatUnits(sharesPreview.data ?? 0n, 18)} {vault.shareSymbol}
            </span>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[11px] text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5">
          {needsApproval ? (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={approve}
              disabled={!canSubmit}
            >
              {approveReceipt.isLoading ? "Approving..." : `Approve ${vault.asset.symbol}`}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={deposit}
              disabled={!canSubmit}
            >
              {depositReceipt.isLoading ? "Depositing..." : "Deposit"}
            </button>
          )}
        </div>

        <p className="mt-3 text-[10px] leading-4 text-faint">
          Shares are minted to your wallet. The keeper manages the underlying
          strategy; withdrawals remain on-chain.
        </p>
      </div>
    </div>
  );
}
