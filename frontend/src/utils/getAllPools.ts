import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  type Log,
} from "ethers";
import { CONTRACTS } from "@/config";

const RPC_URLS = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_RPC_URL,
      "https://rpc.fuse.io/",
      "https://fuse.drpc.org",
      "https://122.rpc.thirdweb.com",
    ].filter((url): url is string => Boolean(url)),
  ),
);

const FACTORY_DEPLOY_BLOCK = Number(
  process.env.NEXT_PUBLIC_ALGEBRA_FACTORY_DEPLOY_BLOCK || "32498119",
);
const BLOCK_CHUNK = 5_000;
const MIN_BLOCK_CHUNK = 100;
const CACHE_KEY = "blueberry:algebra-pools:v4";
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

const providers = RPC_URLS.map(
  (url) => new JsonRpcProvider(url, 122, { staticNetwork: true }),
);
let providerIndex = 0;
let hadRpcError = false;

function getProvider(): JsonRpcProvider {
  return providers[providerIndex % providers.length];
}

function nextProvider(): boolean {
  if (providers.length <= 1) return false;
  if (providerIndex >= providers.length - 1) return false;
  providerIndex += 1;
  return true;
}

async function getLogsSegment(fromBlock: number, toBlock: number): Promise<Log[]> {
  const provider = getProvider();
  try {
    return await provider.getLogs({
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
  } catch (error) {
    // Public Fuse RPCs often reject wide ranges. Halve until 100 blocks.
    if (toBlock - fromBlock > MIN_BLOCK_CHUNK) {
      const middle = Math.floor((fromBlock + toBlock) / 2);
      const left = await getLogsSegment(fromBlock, middle);
      const right = await getLogsSegment(middle + 1, toBlock);
      return [...left, ...right];
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[pools] getLogs failed ${fromBlock}-${toBlock} on ${RPC_URLS[providerIndex]}: ${message}`,
    );
    hadRpcError = true;

    // One more attempt on the next RPC for this small segment.
    if (nextProvider()) {
      return getLogsSegment(fromBlock, toBlock);
    }

    return [];
  }
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
      !Array.isArray(parsed.pools) ||
      parsed.pools.length === 0
    ) {
      return null;
    }
    return parsed.pools;
  } catch {
    return null;
  }
}

function writeCache(pools: PoolInfo[]): void {
  if (typeof window === "undefined" || pools.length === 0) return;
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
    output.push(...(await Promise.all(batch.map(fn))));
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

async function latestBlock(): Promise<number> {
  let lastError: unknown;
  for (let index = 0; index < providers.length; index += 1) {
    try {
      return await providers[(providerIndex + index) % providers.length].getBlockNumber();
    } catch (error) {
      lastError = error;
      hadRpcError = true;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("no RPC available");
}

export async function getAllPools(forceRefresh = false): Promise<PoolInfo[]> {
  if (typeof window === "undefined") return [];

  if (forceRefresh) {
    window.localStorage.removeItem(CACHE_KEY);
  } else {
    const cached = readCache();
    if (cached) return cached;
  }

  hadRpcError = false;
  providerIndex = 0;

  try {
    const latest = await latestBlock();
    const poolAddresses = new Set<string>();

    for (
      let fromBlock = FACTORY_DEPLOY_BLOCK;
      fromBlock <= latest;
      fromBlock += BLOCK_CHUNK
    ) {
      const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latest);
      const logs = await getLogsSegment(fromBlock, toBlock);

      for (const log of logs) {
        try {
          const parsed = factoryInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed?.args?.pool) {
            poolAddresses.add(getAddress(String(parsed.args.pool)));
          }
        } catch (error) {
          hadRpcError = true;
          console.warn("[pools] malformed factory log", error);
        }
      }
    }

    const pools = await inBatches(
      Array.from(poolAddresses),
      10,
      async (poolAddress) => {
        try {
          const pool = new Contract(poolAddress, poolAbi, getProvider());
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
        } catch (error) {
          hadRpcError = true;
          console.warn(`[pools] pool ${poolAddress} read failed`, error);
          return null;
        }
      },
    );

    const validPools = pools.filter(
      (pool): pool is NonNullable<typeof pool> => pool !== null,
    );

    const tokenAddresses = Array.from(
      new Set(validPools.flatMap((pool) => [pool.token0, pool.token1])),
    );

    const metadata = new Map(
      await inBatches(tokenAddresses, 10, async (address) => {
        const info = await tokenMetadata(address, getProvider());
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

    // Never cache an empty or partially broken result.
    if (result.length === 0 || hadRpcError) {
      return result;
    }

    writeCache(result);
    return result;
  } catch (error) {
    hadRpcError = true;
    console.error("[pools] getAllPools failed", error);
    const cached = readCache();
    return cached ?? [];
  }
}

export function poolFeeLabel(fee: number): string {
  if (!Number.isFinite(fee) || fee <= 0) return "fee —";
  return `${(fee / 10_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}% fee`;
}
