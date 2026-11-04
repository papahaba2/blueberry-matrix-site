import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

    const CONFIG = {
      chainId: 122,
      chainIdHex: "0x7a",
      chainName: "Fuse Mainnet",
      rpcUrl: "https://rpc.fuse.io/",
      explorer: "https://explorer.fuse.io",
      vault: "0xf1227c2419f3535d918B0174b7Df5AbC602d718e",
      wfuse: "0x0BE9e53fd7EDaC9F859882AfdDa116645287C629",
      berry: "0x5Dc3fc8B4C0Fcb33F7af13F14920172FEf288069"
    };

    const VAULTS = {
      WFUSE: {
        key: "WFUSE",
        label: "WFUSE Vault",
        address: "0xf1227c2419f3535d918B0174b7Df5AbC602d718e",
        asset: "0x0BE9e53fd7EDaC9F859882AfdDa116645287C629",
        symbol: "WFUSE",
        shareSymbol: "frVLT",
        decimals: 18,
        icon: "W"
      },
      USDC: {
        key: "USDC",
        label: "USDC Vault",
        address: "0x53968BA736439d7838E88e0F7BCb47A4d9C6955a",
        asset: "0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9",
        symbol: "USDC",
        shareSymbol: "bbUSDC",
        decimals: 6,
        icon: "$"
      }
    };

    const FUSE_CHAIN = {
      chainId: CONFIG.chainIdHex,
      chainName: CONFIG.chainName,
      nativeCurrency: { name: "Fuse", symbol: "FUSE", decimals: 18 },
      rpcUrls: [CONFIG.rpcUrl],
      blockExplorerUrls: [CONFIG.explorer]
    };

    const ROUTER = "0x6E055FfA786Dfe9DBB214b649a9b2A169e6B820b";
    const QUOTER = "0x87294CA0cF9a7E0226b91d84B2dEc89130Cac7cd";
    const SWAP_SLIPPAGE_BPS = 50;
    // Algebra default pools use address(0) here. The router's poolDeployer
    // (0x9F02...) is only for custom pools; passing it routes to a nonexistent pool.
    const ALGEBRA_DEPLOYER = ethers.ZeroAddress;

    const TOKENS = {
      WFUSE: {
        symbol: "WFUSE",
        name: "Wrapped Fuse",
        address: "0x0BE9e53fd7EDaC9F859882AfdDa116645287C629",
        decimals: 18,
        icon: "W",
        color: "#4de3c1"
      },
      USDC: {
        symbol: "USDC",
        name: "Stargate Bridged USDC",
        address: "0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9",
        decimals: 6,
        icon: "$",
        color: "#2775ca"
      },
      USDT: {
        symbol: "USDT",
        name: "Stargate Bridged USDT",
        address: "0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7",
        decimals: 6,
        icon: "T",
        color: "#26a17b"
      },
      BERRY: {
        symbol: "BERRY",
        name: "Blueberry Matrix Token",
        address: "0x5Dc3fc8B4C0Fcb33F7af13F14920172FEf288069",
        decimals: 18,
        icon: "B",
        color: "#7c5cff"
      },
      SFUSE: {
        symbol: "sFUSE",
        name: "Liquid staked FUSE",
        address: "0xb1DD0B683d9A56525cC096fbF5eec6E60FE79871",
        decimals: 18,
        icon: "s",
        color: "#4de3c1"
      },
      WETH: {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x5622F6dC93e08a8b717B149677930C38d5d50682",
        decimals: 18,
        icon: "E",
        color: "#627eea"
      },
      SOUSD: {
        symbol: "soUSD",
        name: "New Token · Solid USD",
        address: "0x75333830E7014e909535389a6E5b0C02aA62ca27",
        decimals: 6,
        icon: "S",
        color: "#a3e635"
      }
    };
    const TOKEN_LIST = Object.values(TOKENS);

    const BERRY_PROPOSALS = [
      {
        id: "meridian",
        title: "Add Meridian Lend",
        description: "Add Meridian Lend as an approved strategy for the vault and let the keeper route capital there when its APR wins.",
        target: "0x45c672D27A10E36856625036e3a3dd92C56dCE2E",
        category: "Strategy"
      },
      {
        id: "fee",
        title: "Lower Fee to 0.03%",
        description: "Reduce the vault performance fee from 5 bps to 3 bps, keeping more yield with depositors.",
        target: "0xf1227c2419f3535d918B0174b7Df5AbC602d718e",
        category: "Fee"
      },
      {
        id: "berry-rewards",
        title: "BERRY / WFUSE incentives",
        description: "Signal support for a BERRY/WFUSE liquidity incentive program on Fuse.",
        target: "0x0BE9e53fd7EDaC9F859882AfdDa116645287C629",
        category: "Liquidity"
      }
    ];

    const ROUTER_ABI = [
      "function exactInputSingle((address tokenIn, address tokenOut, address deployer, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) params) payable returns (uint256 amountOut)"
    ];

    const QUOTER_ABI = [
      "function quoteExactInputSingle((address tokenIn, address tokenOut, address deployer, uint256 amountIn, uint160 limitSqrtPrice) params) returns (uint256 amountOut, uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate, uint16 fee)"
    ];

    const BERRY_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function voteForStrategy(address strategy)",
      "function votedForStrategy(address voter, address strategy) view returns (bool)",
      "function strategyVotes(address strategy) view returns (uint256)"
    ];

    const VAULT_ABI = [
      "function totalAssets() view returns (uint256)",
      "function currentStrategy() view returns (address)",
      "function maxSlippageBps() view returns (uint256)",
      "function maxWithdraw(address owner) view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function convertToAssets(uint256 shares) view returns (uint256)",
      "function deposit(uint256 assets, address receiver) returns (uint256)",
      "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];

    const STRATEGY_ABI = ["function aprBps() view returns (uint256)"];

    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function decimals() view returns (uint8)"
    ];

export {
  CONFIG,
  VAULTS,
  FUSE_CHAIN,
  ROUTER,
  QUOTER,
  SWAP_SLIPPAGE_BPS,
  ALGEBRA_DEPLOYER,
  TOKENS,
  TOKEN_LIST,
  ERC20_ABI,
  ROUTER_ABI,
  QUOTER_ABI,
  BERRY_ABI,
  VAULT_ABI,
  STRATEGY_ABI
};
