import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  type Log,
} from "ethers";
import { CONTRACTS, SEED_POOLS } from "@/config";

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
const MAX_SCAN_MS = 60_000;
const MAX_REQUESTS = 800;

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

export type PoolProgress = {
  running: boolean;
  complete: boolean;
  scanned: number;
  latest: number;
  total: number;
  found: number;
  elapsedMs: number;
  startedAt: number;
  error: string;
};

type CachePayload = {
  pools: PoolInfo[];
  lastScannedBlock: number;
  startedAt: number;
  complete: boolean;
};

type LegacyCache = PoolInfo[];

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

let currentPools: PoolInfo[] = seedSnapshot();
let currentProgress: PoolProgress = {
  running: false,
  complete: false,
  scanned: 0,
  latest: 0,
  total: 0,
  found: 0,
  elapsedMs: 0,
  startedAt: 0,
  error: "",
};
let scanning = false;
let stopRequested = false;
let lastScannedBlock = 0;
let scanStartedAt = 0;
let scanComplete = false;

function getProvider(): JsonRpcProvider {
  return providers[providerIndex % providers.length];
}

function nextProvider(): boolean {
  if (providerIndex >= providers.length - 1) return false;
  providerIndex += 1;
  return true;
}

function seedSnapshot(): PoolInfo[] {
  return SEED_POOLS.filter((seed) => Boolean(seed.poolAddress)).map((seed) => ({
    name: `${seed.symbol0}/${seed.symbol1}`,
    token0: seed.token0,
    token1: seed.token1,
    symbol0: seed.symbol0,
    symbol1: seed.symbol1,
    decimals0: seed.decimals0,
    decimals1: seed.decimals1,
    fee: seed.fee,
    tickSpacing: seed.tickSpacing ?? 60,
    poolAddress: seed.poolAddress as string,
  }));
}

function mergePools(left: PoolInfo[], right: PoolInfo[]): PoolInfo[] {
  const byAddress = new Map<string, PoolInfo>();
  for (const pool of [...left, ...right]) {
    if (pool.poolAddress) byAddress.set(pool.poolAddress.toLowerCase(), pool);
  }
  return Array.from(byAddress.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function readCache(): CachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload | LegacyCache;

    // Old format: PoolInfo[] with no cursor.
    if (Array.isArray(parsed)) {
      return {
        pools: parsed,
        lastScannedBlock: 0,
        startedAt: 0,
        complete: false,
      };
    }

    if (!parsed?.pools || !Array.isArray(parsed.pools)) return null;
    return {
      pools: parsed.pools,
      lastScannedBlock: Number(parsed.lastScannedBlock) || 0,
      startedAt: Number(parsed.startedAt) || 0,
      complete: Boolean(parsed.complete),
    };
  } catch {
    return null;
  }
}

function writeCache(): void {
  if (typeof window === "undefined") return;
  if (currentPools.length === 0) return;
  try {
    const payload: CachePayload = {
      pools: currentPools,
      lastScannedBlock,
      startedAt: scanStartedAt,
      complete: scanComplete,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is best-effort.
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

async function getLogsSegment(fromBlock: number, toBlock: number): Promise<Log[]> {
  try {
    return await getProvider().getLogs({
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
    if (toBlock - fromBlock > MIN_BLOCK_CHUNK) {
      const middle = Math.floor((fromBlock + toBlock) / 2);
      return [
        ...(await getLogsSegment(fromBlock, middle)),
        ...(await getLogsSegment(middle + 1, toBlock)),
      ];
    }

    hadRpcError = true;
    console.warn(
      `[pools] getLogs failed ${fromBlock}-${toBlock} on ${RPC_URLS[providerIndex]}`,
      error,
    );

    if (nextProvider()) return getLogsSegment(fromBlock, toBlock);
    return [];
  }
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

async function resolveSeedPools(): Promise<PoolInfo[]> {
  const resolved: PoolInfo[] = [];
  for (const seed of SEED_POOLS) {
    try {
      let poolAddress = seed.poolAddress ? getAddress(seed.poolAddress) : "";
      if (!poolAddress) {
        poolAddress = getAddress(
          await new Contract(
            CONTRACTS.factory,
            ["function poolByPair(address,address) view returns (address)"],
            getProvider(),
          ).poolByPair(seed.token0, seed.token1),
        );
        if (poolAddress === "0x0000000000000000000000000000000000000000") {
          continue;
        }
      }

      let fee = seed.fee;
      let tickSpacing = seed.tickSpacing ?? 60;
      try {
        const pool = new Contract(poolAddress, poolAbi, getProvider());
        fee = Number(await pool.fee());
        tickSpacing = Number(await pool.tickSpacing());
      } catch {
        // Keep seed metadata when the pool read is temporarily unavailable.
      }

      resolved.push({
        name: `${seed.symbol0}/${seed.symbol1}`,
        token0: seed.token0,
        token1: seed.token1,
        symbol0: seed.symbol0,
        symbol1: seed.symbol1,
        decimals0: seed.decimals0,
        decimals1: seed.decimals1,
        fee,
        tickSpacing,
        poolAddress,
      });
    } catch {
      // A seed that has no pool on this factory is skipped.
    }
  }
  return resolved;
}

function updateProgress(error = ""): void {
  const elapsedMs = scanStartedAt ? Date.now() - scanStartedAt : 0;
  currentProgress = {
    running: scanning,
    complete: scanComplete,
    scanned: Math.max(0, lastScannedBlock - FACTORY_DEPLOY_BLOCK),
    latest: currentProgress.latest,
    total: Math.max(0, currentProgress.latest - FACTORY_DEPLOY_BLOCK),
    found: currentPools.length,
    elapsedMs,
    startedAt: scanStartedAt,
    error,
  };
}

async function scanPools(forceRefresh: boolean, initialLatest = 0): Promise<void> {
  if (scanning) return;

  scanning = true;
  stopRequested = false;
  hadRpcError = false;
  providerIndex = 0;
  scanStartedAt = Date.now();
  currentProgress = {
    ...currentProgress,
    running: true,
    complete: false,
    error: "",
    startedAt: scanStartedAt,
    latest: initialLatest,
  };

  try {
    const latest = initialLatest || (await latestBlock());
    currentProgress.latest = latest;

    const cache = forceRefresh ? null : readCache();
    if (forceRefresh) {
      window.localStorage.removeItem(CACHE_KEY);
    }

    if (!cache || cache.lastScannedBlock <= 0) {
      lastScannedBlock = FACTORY_DEPLOY_BLOCK - 1;
      scanComplete = false;
    } else {
      lastScannedBlock = Math.max(FACTORY_DEPLOY_BLOCK - 1, cache.lastScannedBlock);
      scanComplete = false;
    }

    currentPools = mergePools(
      currentPools.length > 0 ? currentPools : seedSnapshot(),
      cache?.pools ?? [],
    );

    const seedPools = await resolveSeedPools();
    currentPools = mergePools(currentPools, seedPools);

    console.log(
      `[pools] scan start from=${Math.max(FACTORY_DEPLOY_BLOCK, lastScannedBlock + 1)} to=${latest} step=${BLOCK_CHUNK} complete=false`,
    );

    let requests = 0;
    for (
      let fromBlock = Math.max(FACTORY_DEPLOY_BLOCK, lastScannedBlock + 1);
      fromBlock <= latest;
      fromBlock += BLOCK_CHUNK
    ) {
      if (stopRequested) break;
      if (Date.now() - scanStartedAt > MAX_SCAN_MS || requests >= MAX_REQUESTS) {
        currentProgress.error = "scan-limit";
        break;
      }

      const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latest);
      let logs: Log[] = [];
      try {
        logs = await getLogsSegment(fromBlock, toBlock);
      } catch (error) {
        hadRpcError = true;
        currentProgress.error = error instanceof Error ? error.message : "rpc-error";
        break;
      }

      for (const log of logs) {
        try {
          const parsed = factoryInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed?.args?.pool) {
            const poolAddress = getAddress(String(parsed.args.pool));
            const token0 = getAddress(String(parsed.args.token0));
            const token1 = getAddress(String(parsed.args.token1));
            const meta0 = await tokenMetadata(token0, getProvider());
            const meta1 = await tokenMetadata(token1, getProvider());
            const pool = new Contract(poolAddress, poolAbi, getProvider());
            const [fee, tickSpacing] = await Promise.all([
              pool.fee(),
              pool.tickSpacing(),
            ]);
            currentPools = mergePools(currentPools, [
              {
                name: `${meta0.symbol}/${meta1.symbol}`,
                token0,
                token1,
                symbol0: meta0.symbol,
                symbol1: meta1.symbol,
                decimals0: meta0.decimals,
                decimals1: meta1.decimals,
                fee: Number(fee),
                tickSpacing: Number(tickSpacing),
                poolAddress,
              },
            ]);
          }
        } catch (error) {
          console.warn("[pools] pool parse failed", error);
        }
      }

      lastScannedBlock = toBlock;
      requests += 1;

      if (
        requests % 50 === 0 ||
        toBlock >= latest ||
        Date.now() - scanStartedAt > MAX_SCAN_MS
      ) {
        scanComplete = toBlock >= latest && !hadRpcError;
        writeCache();
        updateProgress();
        console.log(
          `[pools] progress scanned=${Math.max(0, lastScannedBlock - FACTORY_DEPLOY_BLOCK)}/${Math.max(0, latest - FACTORY_DEPLOY_BLOCK)} found=${currentPools.length} elapsed=${Math.round((Date.now() - scanStartedAt) / 1000)}s`,
        );
      }

      if (hadRpcError) {
        currentProgress.error = "rpc-error";
        break;
      }
    }

    if (!hadRpcError && !stopRequested && lastScannedBlock >= latest) {
      scanComplete = true;
    }

    currentPools = mergePools(currentPools, seedSnapshot());
    updateProgress();
    writeCache();

    const elapsed = Math.round((Date.now() - scanStartedAt) / 1000);
    if (scanComplete) {
      console.log(
        `[pools] done scanned=${Math.max(0, lastScannedBlock - FACTORY_DEPLOY_BLOCK)} total=${currentPools.length} in=${elapsed}s`,
      );
    } else {
      console.log(
        `[pools] partial: saved cursor=${lastScannedBlock}, error=${currentProgress.error || "scan-limit"}, total=${currentPools.length}`,
      );
    }
  } catch (error) {
    hadRpcError = true;
    currentProgress.error = error instanceof Error ? error.message : String(error);
    currentPools = mergePools(currentPools, seedSnapshot());
    writeCache();
    updateProgress(currentProgress.error);
    console.warn("[pools] scan aborted", error);
  } finally {
    scanning = false;
    currentProgress.running = false;
    currentProgress.complete = scanComplete;
    updateProgress(currentProgress.error);
  }
}

export function getPoolSnapshot(): PoolInfo[] {
  return currentPools;
}

export function getPoolProgress(): PoolProgress {
  return currentProgress;
}

export function stopPoolScan(): void {
  stopRequested = true;
}

/**
 * Returns the current seed/cache snapshot immediately and starts an
 * incremental background scan. Subscribe via polling getPoolSnapshot().
 */
export async function getAllPools(forceRefresh = false): Promise<PoolInfo[]> {
  if (typeof window === "undefined") return currentPools;

  if (forceRefresh) {
    window.localStorage.removeItem(CACHE_KEY);
    currentPools = seedSnapshot();
    lastScannedBlock = FACTORY_DEPLOY_BLOCK - 1;
    scanComplete = false;
  }

  if (!scanning) {
    if (forceRefresh) {
      scanning = false;
      stopRequested = false;
    }
    currentPools = mergePools(
      currentPools.length > 0 ? currentPools : seedSnapshot(),
      seedSnapshot(),
    );
    void scanPools(forceRefresh);
  }

  return currentPools;
}

export function poolFeeLabel(fee: number): string {
  if (!Number.isFinite(fee) || fee <= 0) return "fee —";
  return `${(fee / 10_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}% fee`;
}
