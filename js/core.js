import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import { CONFIG, TOKENS } from "./config.js";

const walletEvents = new EventTarget();
const dataEvents = new EventTarget();

export function emitDataRefresh() {
  dataEvents.dispatchEvent(new Event("data:refresh"));
}

export function onDataRefresh(handler) {
  dataEvents.addEventListener("data:refresh", () => handler());
}

export function emitWalletConnected(account) {
  walletEvents.dispatchEvent(new CustomEvent("wallet:connected", { detail: { account } }));
}

export function onWalletConnected(handler) {
  walletEvents.addEventListener("wallet:connected", (event) => handler(event.detail));
}

    const state = {
      provider: null,
      signer: null,
      account: null,
      wallets: [],
      walletProvider: null,
      vault: null,
      vaultWrite: null,
      wfuse: null,
      wfuseWrite: null,
      shares: null,
      publicProvider: null,
      publicVault: null,
      activeVault: "WFUSE",
      assetSymbol: "WFUSE",
      shareSymbol: "frVLT",
      decimals: 18,
      wfuseBalance: 0n,
      sharesBalance: 0n,
      totalAssets: 0n,
      totalSupply: 0n,
      sharePrice: 0n,
      strategyAprBps: 0n,
      maxWithdraw: 0n,
      allowance: 0n,
      swapFrom: TOKENS.WFUSE,
      swapTo: TOKENS.USDC,
      swapFromBalance: 0n,
      swapToBalance: 0n,
      swapAllowance: 0n,
      swapQuote: null,
      swapQuoteLoading: false,
      swapQuoteError: "",
      swapPriceImpact: null,
      swapSeq: 0,
      swapModalSide: "from",
      berry: null,
      berryWrite: null,
      berryBalance: 0n,
      berryDecimals: 18,
      governanceLoaded: false,
      networkLoaded: false,
      networkLoading: false,
      networkTimer: null,
      networkData: null,
      busy: false,
      connecting: false
    };

    const els = {
      connectBtn: document.getElementById("connectBtn"),
      networkBadge: document.getElementById("networkBadge"),
      networkText: document.getElementById("networkText"),
      wfuseBalance: document.getElementById("wfuseBalance"),
      sharesBalance: document.getElementById("sharesBalance"),
      vaultAssetLabel: document.getElementById("vaultAssetLabel"),
      vaultShareLabel: document.getElementById("vaultShareLabel"),
      vaultHeadingAsset: document.getElementById("vaultHeadingAsset"),
      vaultPositionNote: document.getElementById("vaultPositionNote"),
      sharePriceNote: document.getElementById("sharePriceNote"),
      totalSharesNote: document.getElementById("totalSharesNote"),
      depositSub: document.getElementById("depositSub"),
      depositPill: document.getElementById("depositPill"),
      depositTokenIcon: document.getElementById("depositTokenIcon"),
      depositTokenText: document.getElementById("depositTokenText"),
      withdrawSub: document.getElementById("withdrawSub"),
      withdrawPill: document.getElementById("withdrawPill"),
      withdrawTokenIcon: document.getElementById("withdrawTokenIcon"),
      withdrawTokenText: document.getElementById("withdrawTokenText"),
      vaultSwitchButtons: Array.from(document.querySelectorAll(".vault-switch-btn")),
      yourShareNote: document.getElementById("yourShareNote"),
      vaultTvl: document.getElementById("vaultTvl"),
      vaultHeroTvl: document.getElementById("vaultHeroTvl"),
      vaultHeroStrategy: document.getElementById("vaultHeroStrategy"),
      vaultHeroApr: document.getElementById("vaultHeroApr"),
      vaultHeroShares: document.getElementById("vaultHeroShares"),
      vaultHeroSharePrice: document.getElementById("vaultHeroSharePrice"),
      sharePrice: document.getElementById("sharePrice"),
      totalShares: document.getElementById("totalShares"),
      strategyApr: document.getElementById("strategyApr"),
      depositInput: document.getElementById("depositInput"),
      depositMaxBtn: document.getElementById("depositMaxBtn"),
      depositBalanceHint: document.getElementById("depositBalanceHint"),
      depositHint: document.getElementById("depositHint"),
      depositAllowanceHint: document.getElementById("depositAllowanceHint"),
      approveBtn: document.getElementById("approveBtn"),
      depositBtn: document.getElementById("depositBtn"),
      withdrawInput: document.getElementById("withdrawInput"),
      withdrawMaxBtn: document.getElementById("withdrawMaxBtn"),
      withdrawBalanceHint: document.getElementById("withdrawBalanceHint"),
      withdrawHint: document.getElementById("withdrawHint"),
      withdrawLimitHint: document.getElementById("withdrawLimitHint"),
      withdrawBtn: document.getElementById("withdrawBtn"),
      currentStrategy: document.getElementById("currentStrategy"),
      maxSlippage: document.getElementById("maxSlippage"),
      txStatus: document.getElementById("txStatus"),
      txSpinner: document.getElementById("txSpinner"),
      txText: document.getElementById("txText"),
      toast: document.getElementById("toast"),
      toastTitle: document.getElementById("toastTitle"),
      toastMessage: document.getElementById("toastMessage"),
      toastLinkWrap: document.getElementById("toastLinkWrap"),
      themeBtn: document.getElementById("themeBtn"),
      themeLabel: document.getElementById("themeLabel"),
      vaultView: document.getElementById("vaultView"),
      swapView: document.getElementById("swapView"),
      tabs: Array.from(document.querySelectorAll(".tab")),
      fromAmount: document.getElementById("fromAmount"),
      toAmount: document.getElementById("toAmount"),
      fromTokenBtn: document.getElementById("fromTokenBtn"),
      toTokenBtn: document.getElementById("toTokenBtn"),
      fromBalanceLabel: document.getElementById("fromBalanceLabel"),
      toBalanceLabel: document.getElementById("toBalanceLabel"),
      fromBalanceHint: document.getElementById("fromBalanceHint"),
      toBalanceHint: document.getElementById("toBalanceHint"),
      fromMaxBtn: document.getElementById("fromMaxBtn"),
      switchTokens: document.getElementById("switchTokens"),
      swapRate: document.getElementById("swapRate"),
      swapRoute: document.getElementById("swapRoute"),
      swapBtn: document.getElementById("swapBtn"),
      swapStatus: document.getElementById("swapStatus"),
      swapSlippage: document.getElementById("swapSlippage"),
      tokenModal: document.getElementById("tokenModal"),
      tokenList: document.getElementById("tokenList"),
      closeTokenModal: document.getElementById("closeTokenModal"),
      walletModal: document.getElementById("walletModal"),
      walletList: document.getElementById("walletList"),
      closeWalletModal: document.getElementById("closeWalletModal"),
      networkView: document.getElementById("networkView"),
      networkLive: document.getElementById("networkLive"),
      networkRefresh: document.getElementById("networkRefresh"),
      networkStats: document.getElementById("networkStats"),
      networkUpdated: document.getElementById("networkUpdated"),
      tpsHistogram: document.getElementById("tpsHistogram"),
      gasHistogram: document.getElementById("gasHistogram"),
      tpsNow: document.getElementById("tpsNow"),
      gasNow: document.getElementById("gasNow"),
      txFeed: document.getElementById("txFeed"),
      feedCount: document.getElementById("feedCount"),
      landingView: document.getElementById("landingView"),
      appView: document.getElementById("appView"),
      homeBtn: document.getElementById("homeBtn"),
      launchApp: document.getElementById("launchApp"),
      landingTvl: document.getElementById("landingTvl"),
      landingApr: document.getElementById("landingApr"),
      landingTerminalTvl: document.getElementById("landingTerminalTvl"),
      landingTerminalApr: document.getElementById("landingTerminalApr"),
      berryBalance: document.getElementById("berryBalance"),
      governanceView: document.getElementById("governanceView"),
      govBerryBalance: document.getElementById("govBerryBalance"),
      govVotingPower: document.getElementById("govVotingPower"),
      govConnectBtn: document.getElementById("govConnectBtn"),
      govProposalCount: document.getElementById("govProposalCount"),
      proposalList: document.getElementById("proposalList"),
      priceImpact: document.getElementById("priceImpact"),
      minimumReceived: document.getElementById("minimumReceived")
    };

    const THEME_KEY = "fuse-vault-theme";
    let toastTimer = null;

    function applyTheme(theme) {
      const fuseTheme = theme === "fuse";
      document.documentElement.dataset.theme = fuseTheme ? "fuse" : "dark";
      els.themeLabel.textContent = fuseTheme ? "Dark" : "Fuse";
      els.themeBtn.setAttribute("aria-pressed", String(fuseTheme));
    }

    function readStoredTheme() {
      try {
        return localStorage.getItem(THEME_KEY) === "fuse" ? "fuse" : "dark";
      } catch {
        return "dark";
      }
    }

    function toggleTheme() {
      const current = document.documentElement.dataset.theme === "fuse" ? "fuse" : "dark";
      const next = current === "fuse" ? "dark" : "fuse";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // file:// or private mode may block localStorage; theme still works for this session.
      }
    }
    function shortAddress(address) {
      return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }

    function withGrouping(value) {
      return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function formatToken(value) {
      const raw = ethers.formatUnits(value, state.decimals);
      if (!raw.includes(".")) return withGrouping(raw);
      const [whole, fraction = ""] = raw.split(".");
      const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
      return trimmed ? `${withGrouping(whole)}.${trimmed}` : withGrouping(whole);
    }

    function formatSharePrice(value) {
      const raw = ethers.formatUnits(value, state.decimals);
      const [whole, fraction = ""] = raw.split(".");
      const padded = `${fraction}00000000`.slice(0, 8);
      return `${withGrouping(whole)}.${padded}`;
    }
    function parseAmount(input) {
      const raw = input.value.trim().replace(",", ".");
      if (!raw || raw === ".") return 0n;
      try {
        return ethers.parseUnits(raw, state.decimals);
      } catch {
        return 0n;
      }
    }

    function formatAmount(value, decimals, maxFraction = 6) {
      const raw = ethers.formatUnits(value, decimals);
      if (!raw.includes(".")) return withGrouping(raw);
      const [whole, fraction = ""] = raw.split(".");
      const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
      return trimmed ? `${withGrouping(whole)}.${trimmed}` : withGrouping(whole);
    }
    function ensurePublicProvider() {
      if (!state.publicProvider) {
        state.publicProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
      }
      return state.publicProvider;
    }
    function sanitizeInput(event) {
      const input = event.currentTarget;
      let value = input.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
      const parts = value.split(".");
      if (parts.length > 2) {
        value = `${parts.shift()}.${parts.join("")}`;
      }
      input.value = value;
      updateButtons();
    }

    function setSyncStatus(text, tone = "") {
      if (!text) {
        els.txText.textContent = "Read-only mode";
        els.txSpinner.hidden = true;
        return;
      }
      els.txText.textContent = text;
      els.txSpinner.hidden = tone !== "loading";
    }

    function setBusy(busy, message = "") {
      state.busy = busy;
      if (busy) {
        setSyncStatus(message || "Waiting for wallet…", "loading");
      } else {
        setSyncStatus("Live · ready");
      }
      updateButtons();
      updateSwapUI();
    }

    function showToast(title, message, kind = "info", hash = "") {
      els.toast.hidden = false;
      els.toast.className = `toast ${kind}`;
      els.toastTitle.textContent = title;
      els.toastMessage.textContent = message;
      els.toastLinkWrap.replaceChildren();

      if (hash) {
        const link = document.createElement("a");
        link.href = `${CONFIG.explorer}/tx/${hash}`;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "View transaction ↗";
        els.toastLinkWrap.append(link);
      }

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        els.toast.hidden = true;
      }, kind === "error" ? 10000 : 7000);
    }

    function friendlyError(error) {
      if (!error) return "Unknown error";
      if (error.code === 4001 || error.code === "ACTION_REJECTED") {
        return "Transaction rejected in wallet.";
      }
      const message =
        error.shortMessage ||
        error.reason ||
        error?.info?.error?.message ||
        error?.data?.message ||
        error.message ||
        String(error);
      return message.length > 220 ? `${message.slice(0, 220)}…` : message;
    }

    function isUnknownChain(error) {
      return (
        error?.code === 4902 ||
        error?.data?.originalError?.code === 4902 ||
        String(error?.message || "").toLowerCase().includes("unrecognized chain")
      );
    }

export {
  state,
  els,
  THEME_KEY,
  applyTheme,
  readStoredTheme,
  toggleTheme,
  shortAddress,
  withGrouping,
  formatToken,
  formatSharePrice,
  parseAmount,
  formatAmount,
  ensurePublicProvider,
  sanitizeInput,
  setSyncStatus,
  setBusy,
  showToast,
  friendlyError,
  isUnknownChain
};
