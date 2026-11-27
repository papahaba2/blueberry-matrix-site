"use client";

import { useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  BERRY_ADDRESS,
  ERC20_ABI,
  STAKING_ABI,
  STAKING_ADDRESS,
  SWAP_ROUTER_ABI,
  SWAP_ROUTER_ADDRESS,
  VOLT_ADDRESS,
  WFUSE_ADDRESS,
} from "@/config";

export type BuyBerryStatus =
  | "idle"
  | "checking"
  | "approving-volt"
  | "swapping"
  | "approving-berry"
  | "depositing"
  | "done"
  | "error";

type StepResult = {
  hash: Hash;
  path: `0x${string}`;
  quote: bigint;
};

const ZERO = BigInt(0);

function encodePath(tokens: Address[]): `0x${string}` {
  let result = "0x";
  for (let i = 0; i < tokens.length; i += 1) {
    result += tokens[i].slice(2).toLowerCase();
    if (i + 1 < tokens.length) result += "0".repeat(40);
  }
  return result as `0x${string}`;
}

function directPath(): `0x${string}` {
  return encodePath([VOLT_ADDRESS, BERRY_ADDRESS]);
}

function multihopPath(): `0x${string}` {
  return encodePath([VOLT_ADDRESS, WFUSE_ADDRESS, BERRY_ADDRESS]);
}

export function useBuyBerryWithVolt() {
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [status, setStatus] = useState<BuyBerryStatus>("idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<Hash>();

  const wait = async (txHash: Hash) => {
    if (!publicClient) throw new Error("RPC client unavailable");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  };

  const quote = async (
    path: `0x${string}`,
    amountIn: bigint,
  ): Promise<bigint> => {
    if (!publicClient || !account) throw new Error("Wallet unavailable");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const { result } = await publicClient.simulateContract({
      account,
      address: SWAP_ROUTER_ADDRESS,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInput",
      args: [
        {
          path,
          recipient: account,
          deadline,
          amountIn,
          amountOutMinimum: ZERO,
        },
      ],
      value: ZERO,
    });
    return result as bigint;
  };

  const swap = async (
    path: `0x${string}`,
    amountIn: bigint,
    minOut: bigint,
  ): Promise<StepResult> => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const txHash = await writeContractAsync({
      address: SWAP_ROUTER_ADDRESS,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInput",
      args: [
        {
          path,
          recipient: account as Address,
          deadline,
          amountIn,
          amountOutMinimum: minOut,
        },
      ],
      value: ZERO,
    });
    await wait(txHash);
    return { hash: txHash, path, quote: minOut };
  };

  const buy = async (amountIn: bigint) => {
    if (!account) {
      setError("Подключите кошелёк.");
      setStatus("error");
      return;
    }
    if (!publicClient) {
      setError("RPC недоступен.");
      setStatus("error");
      return;
    }

    setError("");
    setHash(undefined);
    setStatus("checking");

    try {
      const balance = await publicClient.readContract({
        address: VOLT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account],
      });
      if (balance < amountIn) {
        throw new Error("Недостаточно VOLT.");
      }

      const allowance = await publicClient.readContract({
        address: VOLT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, SWAP_ROUTER_ADDRESS],
      });
      if (allowance < amountIn) {
        setStatus("approving-volt");
        const approveHash = await writeContractAsync({
          address: VOLT_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SWAP_ROUTER_ADDRESS, amountIn],
        });
        setHash(approveHash);
        await wait(approveHash);
      }

      setStatus("swapping");

      const berryBefore = await publicClient.readContract({
        address: BERRY_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account],
      });

      let chosenPath: `0x${string}`;
      let quoted: bigint;
      try {
        chosenPath = directPath();
        quoted = await quote(chosenPath, amountIn);
      } catch {
        chosenPath = multihopPath();
        quoted = await quote(chosenPath, amountIn);
      }
      if (quoted <= ZERO) throw new Error("Swap quote returned zero.");
      const minOut = (quoted * BigInt(99)) / BigInt(100);
      const result = await swap(chosenPath, amountIn, minOut);
      setHash(result.hash);

      const berryAfter = await publicClient.readContract({
        address: BERRY_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account],
      });
      const received = berryAfter - berryBefore;
      if (received <= ZERO) throw new Error("Berry not received.");

      const berryAllowance = await publicClient.readContract({
        address: BERRY_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, STAKING_ADDRESS],
      });
      if (berryAllowance < received) {
        setStatus("approving-berry");
        const approveHash = await writeContractAsync({
          address: BERRY_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [STAKING_ADDRESS, received],
        });
        setHash(approveHash);
        await wait(approveHash);
      }

      setStatus("depositing");
      const topUpHash = await writeContractAsync({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: "topUpRewards",
        args: [received],
      });
      setHash(topUpHash);
      await wait(topUpHash);
      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("User rejected") || message.includes("user rejected")
          ? "Транзакция отклонена в кошельке."
          : message,
      );
      setStatus("error");
    }
  };

  return { buy, status, error, hash };
}
