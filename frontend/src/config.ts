import type { Abi, Address } from "viem";
import ManagerAbi from "@/abi/V4LimitOrderManager.json";

export const APP_NAME = "Blueberry Matrix";
export const FUSE_CHAIN_ID = 122;
export const EXPLORER_URL = "https://explorer.fuse.io";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Deployed Fuse V4 contracts.
 * The manager address is injected at build time so the same source can target
 * a fresh deployment without editing code.
 */
export const LIMIT_ORDER_MANAGER_ADDRESS = (
  process.env.NEXT_PUBLIC_LIMIT_ORDER_MANAGER_ADDRESS ||
  "0xe634e39e96Ad25644B4511c738f7857F87337929"
).trim() as Address;

/**
 * Deployed Fuse V4 contracts.
 * The manager falls back to the live deployment when the build variable is
 * absent, so the UI never shows a false "not configured" error.
 */
export const CONTRACTS = {
  factory: "0xccEdb990abBf0606Cf47e7C6A26e419931c7dc1F" as Address,
  positionManager: "0x52B649B1cE77B349C53Bf0284ba61FD8975e7798" as Address,
  limitOrderManager: LIMIT_ORDER_MANAGER_ADDRESS,
} as const;

/** First block where the manager was deployed. Use 0 to disable event scans. */
export const MANAGER_DEPLOY_BLOCK = Number(
  process.env.NEXT_PUBLIC_LIMIT_ORDER_MANAGER_DEPLOY_BLOCK || "0",
);

export type Token = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  priceUsd?: number;
};

export const TOKENS = {
  WFUSE: {
    symbol: "WFUSE",
    name: "Wrapped Fuse",
    address: "0x0BE9e53fd7EDaC9F859882AfdDa116645287C629",
    decimals: 18,
    priceUsd: Number(process.env.NEXT_PUBLIC_WFUSE_USD_PRICE || "0.05"),
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x620fd5fa44BE6af63715Ef4E65DDFA0387aD13F5",
    decimals: 6,
    priceUsd: 1,
  },
  VOLT: {
    symbol: "VOLT",
    name: "Voltage",
    address: "0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4",
    decimals: 18,
    priceUsd: Number(process.env.NEXT_PUBLIC_VOLT_USD_PRICE || "0"),
  },
} as const satisfies Record<string, Token>;

export type VaultConfig = {
  id: string;
  name: string;
  shareSymbol: string;
  address: Address;
  asset: Token;
  aprBps: number;
  priceUsd: number;
  /** Optional hardcoded USD price for the vault asset. */
};

const WFUSE_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_WFUSE_VAULT_ADDRESS ||
  "0xf1227c2419f3535d918B0174b7Df5AbC602d718e") as Address;
const USDC_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_USDC_VAULT_ADDRESS ||
  "0x53968BA736439d7838E88e0F7BCb47A4d9C6955a") as Address;

export const VAULTS: VaultConfig[] = [
  {
    id: "wfuse",
    name: "WFUSE Vault",
    shareSymbol: "bbWFUSE",
    address: WFUSE_VAULT_ADDRESS,
    asset: TOKENS.WFUSE,
    aprBps: Number(process.env.NEXT_PUBLIC_WFUSE_VAULT_APR_BPS || "20010"),
    priceUsd: TOKENS.WFUSE.priceUsd ?? 0,
  },
  {
    id: "usdc",
    name: "USDC Vault",
    shareSymbol: "bbUSDC",
    address: USDC_VAULT_ADDRESS,
    asset: TOKENS.USDC,
    aprBps: Number(process.env.NEXT_PUBLIC_USDC_VAULT_APR_BPS || "0"),
    priceUsd: 1,
  },
];

export type Pair = {
  id: string;
  label: string;
  a: Token;
  b: Token;
};

export const PAIRS: Pair[] = [
  {
    id: "WFUSE-USDC",
    label: "WFUSE / USDC",
    a: TOKENS.WFUSE,
    b: TOKENS.USDC,
  },
  {
    id: "WFUSE-VOLT",
    label: "WFUSE / VOLT",
    a: TOKENS.WFUSE,
    b: TOKENS.VOLT,
  },
];

/** Algebra addresses are sorted by numeric address, not by UI order. */
export function sortTokens(a: Token, b: Token): [Token, Token] {
  return BigInt(a.address) < BigInt(b.address) ? [a, b] : [b, a];
}

export function tokenByAddress(address: Address): Token | undefined {
  return Object.values(TOKENS).find(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  );
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerToken(address: string): string {
  return `${EXPLORER_URL}/token/${address}`;
}

export const FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "poolByPair",
    outputs: [{ internalType: "address", name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const POOL_ABI = [
  {
    inputs: [],
    name: "globalState",
    outputs: [
      { internalType: "uint160", name: "price", type: "uint160" },
      { internalType: "int24", name: "tick", type: "int24" },
      { internalType: "uint16", name: "fee", type: "uint16" },
      { internalType: "uint16", name: "timepointIndex", type: "uint16" },
      { internalType: "uint8", name: "communityFeeToken0", type: "uint8" },
      { internalType: "uint8", name: "communityFeeToken1", type: "uint8" },
      { internalType: "bool", name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const LIMIT_ORDER_MANAGER_ABI = ManagerAbi as Abi;

export const VAULT_ABI = [
  {
    inputs: [],
    name: "asset",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "receiver", type: "address" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "shares", type: "uint256" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "address", name: "owner", type: "address" },
    ],
    name: "redeem",
    outputs: [{ internalType: "uint256", name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "address", name: "owner", type: "address" },
    ],
    name: "withdraw",
    outputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function isVaultConfigured(vault: VaultConfig): boolean {
  return vault.address !== ZERO_ADDRESS;
}

export function isManagerConfigured(): boolean {
  return CONTRACTS.limitOrderManager !== ZERO_ADDRESS;
}
