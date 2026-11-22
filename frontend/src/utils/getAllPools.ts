import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  type Log,
} from "ethers";
import { CONTRACTS } from "@/config";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.fuse.io/";
const FACTORY_DEPLOY_BLOCK = Number(
  process.env.NEXT_PUBLIC_ALGEBRA_FACTORY_DEPLOY_BLOCK || "32498119",
);
const BLOCK_CHUNK = 50_000;
const CACHE_KEY = "blueberry:algebra-pools:v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type PoolInfo = {
  name: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  fee: number;
  tickSpacing: number;
  poolAddress: string;
};

type CachePayload = {
  timestamp: number;
  pools: PoolInfo[];
};

// The V4 factory emits `Pool` for default pools and `CustomPool` for custom
// pools. It does not emit a `PoolCreated` event.
const factoryInterface = new Interface([
  "event Pool(address indexed token0, address indexed token1, address pool)",
  "event CustomPool(address indexed deployer, address indexed token0, address indexed token1, address pool)",
]);

const poolAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint16)",
  "function tickSpacing() view returns (int24)",
];

const tokenAbi = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

let provider: JsonRpcProvider | undefined;

function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(RPC_URL, 122, { staticNetwork: true });
  }
  return provider;
}

function readCache(): PoolInfo[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (
      !parsed?.timestamp ||
      Date.now() - parsed.timestamp > CACHE_TTL_MS ||
      !Array.isArray(parsed.pools)
    ) {
      return null;
    }
    return parsed.pools;
  } catch {
    return null;
  }
}

function writeCache(pools: PoolInfo[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachePayload = { timestamp: Date.now(), pools };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be full or blocked; search still works in memory.
  }
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    const values = await Promise.all(batch.map(fn));
    output.push(...values);
  }
  return output;
}

async function tokenMetadata(
  tokenAddress: string,
  rpc: JsonRpcProvider,
): Promise<{ symbol: string; decimals: number }> {
  const fallback = `${tokenAddress.slice(0, 4)}…${tokenAddress.slice(-4)}`;
  try {
    const token = new Contract(tokenAddress, tokenAbi, rpc);
    const [symbol, decimals] = await Promise.all([
      token.symbol().catch(() => fallback),
      token.decimals().catch(() => 18),
    ]);
    return {
      symbol: String(symbol || fallback),
      decimals: Number(decimals ?? 18),
    };
  } catch {
    return { symbol: fallback, decimals: 18 };
  }
}

export async function getAllPools(forceRefresh = false): Promise<PoolInfo[]> {
  if (typeof window === "undefined") return [];

  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const rpc = getProvider();

  try {
    const latest = await rpc.getBlockNumber();
    const poolAddresses = new Set<string>();

    for (
      let fromBlock = FACTORY_DEPLOY_BLOCK;
      fromBlock <= latest;
      fromBlock += BLOCK_CHUNK
    ) {
      const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latest);
      try {
        const logs: Log[] = await rpc.getLogs({
          address: CONTRACTS.factory,
          fromBlock,
          toBlock,
          topics: [
            [
              factoryInterface.getEvent("Pool")!.topicHash,
              factoryInterface.getEvent("CustomPool")!.topicHash,
            ],
          ],
        });

        for (const log of logs) {
          try {
            const parsed = factoryInterface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed?.args?.pool) {
              poolAddresses.add(getAddress(String(parsed.args.pool)));
            }
          } catch {
            // Ignore malformed logs and continue with the next chunk.
          }
        }
      } catch (error) {
        console.warn(
          `Factory logs failed ${fromBlock}-${toBlock}; continuing`,
          error,
        );
      }
    }

    const pools = await inBatches(Array.from(poolAddresses), 10, async (poolAddress) => {
      try {
        const pool = new Contract(poolAddress, poolAbi, rpc);
        const [token0, token1, fee, tickSpacing] = await Promise.all([
          pool.token0(),
          pool.token1(),
          pool.fee(),
          pool.tickSpacing(),
        ]);

        return {
          poolAddress,
          token0: getAddress(token0),
          token1: getAddress(token1),
          fee: Number(fee),
          tickSpacing: Number(tickSpacing),
        };
      } catch {
        return null;
      }
    });

    const validPools = pools.filter(
      (pool): pool is NonNullable<typeof pool> => pool !== null,
    );

    const tokenAddresses = Array.from(
      new Set(validPools.flatMap((pool) => [pool.token0, pool.token1])),
    );

    const metadata = new Map(
      await inBatches(tokenAddresses, 10, async (address) => {
        const info = await tokenMetadata(address, rpc);
        return [address, info] as const;
      }),
    );

    const result: PoolInfo[] = validPools
      .map((pool) => {
        const meta0 = metadata.get(pool.token0);
        const meta1 = metadata.get(pool.token1);
        const symbol0 = meta0?.symbol ?? "?";
        const symbol1 = meta1?.symbol ?? "?";

        return {
          ...pool,
          symbol0,
          symbol1,
          decimals0: meta0?.decimals ?? 18,
          decimals1: meta1?.decimals ?? 18,
          name: `${symbol0}/${symbol1}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    writeCache(result);
    return result;
  } catch (error) {
    console.error("getAllPools failed", error);
    const cached = readCache();
    if (cached) return cached;
    return [];
  }
}

export function poolFeeLabel(fee: number): string {
  if (!Number.isFinite(fee) || fee <= 0) return "fee —";
  return `${(fee / 10_000).toFixed(2)}% fee`;
}
