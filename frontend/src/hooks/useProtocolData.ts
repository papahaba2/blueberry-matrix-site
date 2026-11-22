"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from "wagmi";
import {
  CONTRACTS,
  LIMIT_ORDER_MANAGER_ABI,
  MANAGER_DEPLOY_BLOCK,
  TOKENS,
  VAULTS,
  VAULT_ABI,
  ZERO_ADDRESS,
  isManagerConfigured,
  tokenByAddress,
  type VaultConfig,
} from "@/config";

const THIRTY_SECONDS = 30_000;

export type VaultData = {
  config: VaultConfig;
  totalAssets: bigint;
  totalSupply: bigint;
  userShares: bigint;
  userAssets: bigint;
  tvlUsd: number;
  pricePerShare: number;
};

export type ProtocolOrder = {
  orderId: number;
  owner: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  tickLower: number;
  tickUpper: number;
  tokenId: bigint;
  createdAt: number;
  canExecute: boolean;
};

type VaultCall = {
  address: Address;
  abi: typeof VAULT_ABI;
  functionName: "totalAssets" | "totalSupply" | "balanceOf";
  args?: readonly [Address];
};

function bigintValue(value: unknown): bigint {
  return typeof value === "bigint" ? value : 0n;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

export function useProtocolData() {
  const { address: account } = useAccount();
  const publicClient = usePublicClient();

  const [executedCount, setExecutedCount] = useState<number | null>(null);
  const [executedLoading, setExecutedLoading] = useState(false);

  const vaultCalls = useMemo<VaultCall[]>(
    () =>
      VAULTS.flatMap((vault) => [
        {
          address: vault.address,
          abi: VAULT_ABI,
          functionName: "totalAssets" as const,
        },
        {
          address: vault.address,
          abi: VAULT_ABI,
          functionName: "totalSupply" as const,
        },
        {
          address: vault.address,
          abi: VAULT_ABI,
          functionName: "balanceOf" as const,
          args: [account ?? ZERO_ADDRESS] as const,
        },
      ]),
    [account],
  );

  const vaultReads = useReadContracts({
    contracts: vaultCalls,
    allowFailure: true,
    query: { refetchInterval: THIRTY_SECONDS },
  });

  const activeIdsRead = useReadContract({
    address: CONTRACTS.limitOrderManager,
    abi: LIMIT_ORDER_MANAGER_ABI,
    functionName: "getActiveOrders",
    query: {
      enabled: isManagerConfigured(),
      refetchInterval: THIRTY_SECONDS,
    },
  });

  const activeIds = useMemo(
    () =>
      ((activeIdsRead.data as readonly bigint[] | undefined) ?? []).map(
        (id) => Number(id),
      ),
    [activeIdsRead.data],
  );

  const orderCalls = useMemo(
    () =>
      activeIds.map((orderId) => ({
        address: CONTRACTS.limitOrderManager,
        abi: LIMIT_ORDER_MANAGER_ABI,
        functionName: "orders" as const,
        args: [BigInt(orderId)] as const,
      })),
    [activeIds],
  );

  const executableCalls = useMemo(
    () =>
      activeIds.map((orderId) => ({
        address: CONTRACTS.limitOrderManager,
        abi: LIMIT_ORDER_MANAGER_ABI,
        functionName: "canExecute" as const,
        args: [BigInt(orderId)] as const,
      })),
    [activeIds],
  );

  const orderReads = useReadContracts({
    contracts: orderCalls,
    allowFailure: true,
    query: {
      enabled: activeIds.length > 0,
      refetchInterval: THIRTY_SECONDS,
    },
  });

  const executableReads = useReadContracts({
    contracts: executableCalls,
    allowFailure: true,
    query: {
      enabled: activeIds.length > 0,
      refetchInterval: THIRTY_SECONDS,
    },
  });

  const vaults = useMemo<VaultData[]>(
    () =>
      VAULTS.map((config, index) => {
        const totalAssets = bigintValue(
          vaultReads.data?.[index * 3]?.result,
        );
        const totalSupply = bigintValue(
          vaultReads.data?.[index * 3 + 1]?.result,
        );
        const userShares = bigintValue(
          vaultReads.data?.[index * 3 + 2]?.result,
        );
        const pricePerShare =
          totalSupply > 0n
            ? Number(totalAssets) / Number(totalSupply)
            : 0;
        const userAssets = BigInt(Math.floor(Number(userShares) * pricePerShare));
        const assetAmount = Number(
          totalAssets / 10n ** BigInt(config.asset.decimals),
        );

        return {
          config,
          totalAssets,
          totalSupply,
          userShares,
          userAssets,
          tvlUsd: assetAmount * config.priceUsd,
          pricePerShare,
        };
      }),
    [vaultReads.data],
  );

  const orders = useMemo<ProtocolOrder[]>(
    () =>
      activeIds.flatMap((orderId, index) => {
        const row = orderReads.data?.[index];
        if (!row || row.status !== "success" || !row.result) return [];

        const result = row.result as readonly [
          Address,
          Address,
          Address,
          bigint,
          number,
          number,
          bigint,
          boolean,
          bigint,
        ];

        return [
          {
            orderId,
            owner: result[0],
            tokenIn: result[1],
            tokenOut: result[2],
            amountIn: result[3],
            tickLower: Number(result[4]),
            tickUpper: Number(result[5]),
            tokenId: result[6],
            createdAt: numberValue(result[8]),
            canExecute:
              executableReads.data?.[index]?.status === "success" &&
              Boolean(executableReads.data?.[index]?.result),
          },
        ];
      }),
    [activeIds, executableReads.data, orderReads.data],
  );

  const lockedUsd = useMemo(
    () =>
      orders.reduce((sum, order) => {
        const token = tokenByAddress(order.tokenIn);
        if (!token?.priceUsd) return sum;
        const amount = Number(
          order.amountIn / 10n ** BigInt(token.decimals),
        );
        return sum + amount * token.priceUsd;
      }, 0),
    [orders],
  );

  const totalVaultTvlUsd = vaults.reduce((sum, vault) => sum + vault.tvlUsd, 0);
  const totalTvlUsd = totalVaultTvlUsd + lockedUsd;

  useEffect(() => {
    if (
      !publicClient ||
      !isManagerConfigured() ||
      MANAGER_DEPLOY_BLOCK <= 0
    ) {
      setExecutedCount(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setExecutedLoading(true);
      try {
        const logs = await publicClient.getContractEvents({
          address: CONTRACTS.limitOrderManager,
          abi: LIMIT_ORDER_MANAGER_ABI,
          eventName: "OrderExecuted",
          fromBlock: BigInt(MANAGER_DEPLOY_BLOCK),
          toBlock: "latest",
        });
        if (!cancelled) setExecutedCount(logs.length);
      } catch {
        if (!cancelled) setExecutedCount(null);
      } finally {
        if (!cancelled) setExecutedLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(load, THIRTY_SECONDS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [publicClient]);

  const refetch = () => {
    void vaultReads.refetch();
    void activeIdsRead.refetch();
    void orderReads.refetch();
    void executableReads.refetch();
  };

  return {
    vaults,
    orders,
    totalTvlUsd,
    totalVaultTvlUsd,
    lockedUsd,
    activeOrdersCount: activeIds.length,
    executedCount,
    executedLoading,
    isLoading:
      vaultReads.isLoading ||
      activeIdsRead.isLoading ||
      orderReads.isLoading ||
      executableReads.isLoading,
    refetch,
    account,
    managerConfigured: isManagerConfigured(),
  };
}
