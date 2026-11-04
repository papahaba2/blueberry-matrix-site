import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import { CONFIG, VAULTS, VAULT_ABI, STRATEGY_ABI, ERC20_ABI } from "./config.js";
import {
  state,
  els,
  setSyncStatus,
  setBusy,
  showToast,
  friendlyError,
  shortAddress,
  formatToken,
  formatSharePrice,
  parseAmount,
  ensurePublicProvider,
  onWalletConnected,
  emitDataRefresh,
  sanitizeInput,
  updateButtons
} from "./core.js";
import { updateNetworkBadge, openWalletModal } from "./wallet.js";

    function setVaultLabels() {
      const meta = VAULTS[state.activeVault];
      state.assetSymbol = meta.symbol;
      state.shareSymbol = meta.shareSymbol;
      state.decimals = meta.decimals;

      els.vaultAssetLabel.textContent = `Your ${meta.symbol}`;
      els.vaultShareLabel.textContent = `Your ${meta.shareSymbol}`;
      els.vaultHeadingAsset.textContent = meta.symbol;
      els.vaultPositionNote.textContent = `${meta.shareSymbol} shares`;
      els.sharePriceNote.textContent = `${meta.symbol} per ${meta.shareSymbol}`;
      els.totalSharesNote.textContent = `${meta.shareSymbol} total supply`;
      els.depositSub.textContent = `Approve ${meta.symbol}, then mint ${meta.shareSymbol} shares.`;
      els.depositPill.textContent = meta.symbol;
      els.depositTokenIcon.textContent = meta.icon;
      els.depositTokenText.textContent = meta.symbol;
      els.withdrawSub.textContent = `Redeem ${meta.shareSymbol} shares and receive ${meta.symbol}.`;
      els.withdrawPill.textContent = meta.shareSymbol;
      els.withdrawTokenIcon.textContent = meta.icon;
      els.withdrawTokenText.textContent = meta.symbol;
      els.depositInput.setAttribute("aria-label", `${meta.symbol} amount to deposit`);
      els.withdrawInput.setAttribute("aria-label", `${meta.symbol} amount to withdraw`);

      for (const button of els.vaultSwitchButtons) {
        const active = button.dataset.vault === state.activeVault;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      }
    }

    function resetVaultContracts() {
      state.vault = null;
      state.vaultWrite = null;
      state.wfuse = null;
      state.wfuseWrite = null;
      state.shares = null;
      state.publicVault = null;
      state.allowance = 0n;
    }

    function switchVault(key) {
      if (!VAULTS[key] || state.activeVault === key) return;
      state.activeVault = key;
      const meta = VAULTS[key];
      CONFIG.vault = meta.address;
      CONFIG.wfuse = meta.asset;
      state.decimals = meta.decimals;
      setVaultLabels();
      resetVaultContracts();
      resetReadState();

      if (state.account && state.provider && state.signer) {
        state.vault = new ethers.Contract(CONFIG.vault, VAULT_ABI, state.provider);
        state.vaultWrite = new ethers.Contract(CONFIG.vault, VAULT_ABI, state.signer);
        state.wfuse = new ethers.Contract(CONFIG.wfuse, ERC20_ABI, state.provider);
        state.wfuseWrite = new ethers.Contract(CONFIG.wfuse, ERC20_ABI, state.signer);
        state.shares = new ethers.Contract(CONFIG.vault, ERC20_ABI, state.provider);
        setSyncStatus(`Switched to ${meta.label}`, "loading");
        loadData();
      } else {
        setSyncStatus(`Loading ${meta.label}…`, "loading");
        loadPublicStats();
      }
    }
    function updateYourShare() {
      if (!state.account || state.totalSupply === 0n) {
        els.yourShareNote.textContent = "Vault shares";
        els.vaultHeroShares.textContent = "—";
        return;
      }
      const pct =
        Number((state.sharesBalance * 1_000_000n) / state.totalSupply) / 10_000;
      els.yourShareNote.textContent = `Vault shares В· ${pct.toFixed(2)}% of supply`;
      els.vaultHeroShares.innerHTML = `${formatToken(state.sharesBalance)} <span class="unit">${state.shareSymbol}</span>`;
    }

    function renderStrategy(strategy) {
      const isIdle = strategy === ethers.ZeroAddress;
      if (isIdle) {
        els.currentStrategy.textContent = "Idle — no strategy";
        els.currentStrategy.className = "meta-value muted";
        return;
      }

      const link = document.createElement("a");
      link.href = `${CONFIG.explorer}/address/${strategy}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = shortAddress(strategy);
      link.title = strategy;
      els.currentStrategy.className = "meta-value";
      els.currentStrategy.replaceChildren(link);
    }

    async function readVaultStats(vaultContract, readProvider) {
      const [totalAssets, currentStrategy, maxSlippage, totalSupply, shareDecimals] =
        await Promise.all([
          vaultContract.totalAssets(),
          vaultContract.currentStrategy(),
          vaultContract.maxSlippageBps(),
          vaultContract.totalSupply(),
          vaultContract.decimals()
        ]);

      let sharePrice = 0n;
      if (totalSupply > 0n) {
        try {
          sharePrice = await vaultContract.convertToAssets(10n ** BigInt(shareDecimals));
        } catch {
          sharePrice = 0n;
        }
      }

      let strategyAprBps = 0n;
      let hasStrategyApr = false;
      if (currentStrategy !== ethers.ZeroAddress) {
        try {
          const strategy = new ethers.Contract(currentStrategy, STRATEGY_ABI, readProvider);
          strategyAprBps = await strategy.aprBps();
          hasStrategyApr = true;
        } catch {
          hasStrategyApr = false;
        }
      }

      return {
        totalAssets,
        currentStrategy,
        maxSlippage,
        totalSupply,
        sharePrice,
        strategyAprBps,
        hasStrategyApr
      };
    }

    function updateStats(stats) {
      state.totalAssets = stats.totalAssets;
      state.totalSupply = stats.totalSupply;
      state.sharePrice = stats.sharePrice;
      state.strategyAprBps = stats.strategyAprBps;

      const assetSymbol = state.assetSymbol;
      const shareSymbol = state.shareSymbol;
      els.vaultTvl.innerHTML = `${formatToken(stats.totalAssets)} <span class="unit">${assetSymbol}</span>`;
      const landingTvlHtml = `${formatToken(stats.totalAssets)} <span class="unit">${assetSymbol}</span>`;
      els.landingTvl.innerHTML = landingTvlHtml;
      els.landingTerminalTvl.innerHTML = landingTvlHtml;
      els.vaultHeroTvl.innerHTML = landingTvlHtml;
      els.totalShares.innerHTML = `${formatToken(stats.totalSupply)} <span class="unit">${shareSymbol}</span>`;
      const sharePriceHtml =
        stats.totalSupply > 0n
          ? `${formatSharePrice(stats.sharePrice)} <span class="unit">${assetSymbol}</span>`
          : "—";
      els.sharePrice.innerHTML = sharePriceHtml;
      els.vaultHeroSharePrice.innerHTML = sharePriceHtml;
      els.sharePrice.title =
        stats.totalSupply > 0n
          ? `${ethers.formatUnits(stats.sharePrice, state.decimals)} ${assetSymbol} per ${shareSymbol}`
          : "";

      els.maxSlippage.textContent = `${stats.maxSlippage.toString()} bps`;
      els.vaultHeroStrategy.textContent =
        stats.currentStrategy === ethers.ZeroAddress ? "Idle" : shortAddress(stats.currentStrategy);

      let aprText = "—";
      if (stats.currentStrategy === ethers.ZeroAddress) {
        aprText = "Idle";
      } else if (stats.hasStrategyApr) {
        aprText = `${(Number(stats.strategyAprBps) / 100).toFixed(2)}%`;
      }
      els.strategyApr.textContent = aprText;
      els.vaultHeroApr.textContent = aprText;
      els.landingApr.textContent = aprText;
      els.landingTerminalApr.textContent = aprText;

      renderStrategy(stats.currentStrategy);
      updateYourShare();
      updateButtons();
    }

    function resetReadState() {
      state.wfuseBalance = 0n;
      state.sharesBalance = 0n;
      state.totalAssets = 0n;
      state.totalSupply = 0n;
      state.sharePrice = 0n;
      state.strategyAprBps = 0n;
      state.maxWithdraw = 0n;
      state.allowance = 0n;
      state.berryBalance = 0n;

      els.wfuseBalance.textContent = "—";
      els.sharesBalance.textContent = "—";
      els.berryBalance.textContent = "—";
      els.yourShareNote.textContent = "Vault shares";
      els.vaultTvl.textContent = "—";
      els.sharePrice.textContent = "—";
      els.totalShares.textContent = "—";
      els.strategyApr.textContent = "—";
      els.currentStrategy.textContent = "—";
      els.currentStrategy.className = "meta-value muted";
      els.maxSlippage.textContent = "—";
      els.landingTvl.textContent = "—";
      els.landingApr.textContent = "—";
      els.landingTerminalTvl.textContent = "—";
      els.landingTerminalApr.textContent = "—";
      els.vaultHeroTvl.textContent = "—";
      els.vaultHeroStrategy.textContent = "—";
      els.vaultHeroApr.textContent = "—";
      els.vaultHeroShares.textContent = "—";
      els.vaultHeroSharePrice.textContent = "—";
      els.govBerryBalance.textContent = "—";
      els.govVotingPower.textContent = "—";
      updateButtons();
    }

    async function loadPublicStats() {
      try {
        if (!state.publicProvider) {
          state.publicProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
        }
        if (!state.publicVault) {
          state.publicVault = new ethers.Contract(
            CONFIG.vault,
            VAULT_ABI,
            state.publicProvider
          );
        }

        setSyncStatus("Loading public vault data…", "loading");
        const stats = await readVaultStats(state.publicVault, state.publicProvider);
        updateStats(stats);
        updateNetworkBadge(state.account ? "connected" : "readonly");
        if (!state.account) {
          setSyncStatus("Read-only В· public RPC");
        }
      } catch (error) {
        console.error(error);
        updateNetworkBadge(
          state.account ? "connected" : state.publicVault ? "readonly" : "disconnected"
        );
        if (!state.account) {
          setSyncStatus("Public RPC read failed");
          showToast("Public RPC error", friendlyError(error), "error");
        }
      }
    }

    async function loadData(silent = false) {
      if (!state.account || !state.vault) return;
      setSyncStatus("Refreshing vault data…", "loading");

      try {
        const [wfuseBalance, sharesBalance, allowance, decimals] = await Promise.all([
          state.wfuse.balanceOf(state.account),
          state.shares.balanceOf(state.account),
          state.wfuse.allowance(state.account, CONFIG.vault),
          state.wfuse.decimals()
        ]);

        state.decimals = Number(decimals);
        state.wfuseBalance = wfuseBalance;
        state.sharesBalance = sharesBalance;
        state.allowance = allowance;

        const [stats, maxWithdraw] = await Promise.all([
          readVaultStats(state.vault, state.provider),
          state.vault.maxWithdraw(state.account).catch(() => 0n)
        ]);

        state.maxWithdraw = maxWithdraw;

        els.wfuseBalance.innerHTML = `${formatToken(wfuseBalance)} <span class="unit">${state.assetSymbol}</span>`;
        els.sharesBalance.innerHTML = `${formatToken(sharesBalance)} <span class="unit">${state.shareSymbol}</span>`;

        updateStats(stats);
        setSyncStatus("Live В· ready");
        emitDataRefresh();
      } catch (error) {
        console.error(error);
        setSyncStatus("Vault read failed");
        if (!silent) showToast("Read error", friendlyError(error), "error");
      }
    }
    async function approve() {
      if (!state.wfuseWrite || !state.account) {
        showToast("Wallet not connected", "Connect MetaMask first.", "error");
        return;
      }

      // Approve the exact user amount plus a small buffer (1% + 1000 units),
      // never an unlimited allowance. deposit() still sends only `amount`.
      const amount = parseAmount(els.depositInput);
      if (amount <= 0n) {
        showToast("Invalid amount", `Enter a ${state.assetSymbol} amount first.`, "error");
        return;
      }
      const approvalAmount = amount + (amount / 100n) + 1000n;

      setBusy(true, `Confirm ${state.assetSymbol} approval in your wallet…`);
      try {
        const tx = await state.wfuseWrite.approve(CONFIG.vault, approvalAmount);
        showToast("Approval sent", "Waiting for confirmation…", "info", tx.hash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Approval transaction reverted.");
        showToast(
          "Approval confirmed",
          `${state.assetSymbol} approval confirmed. You can now deposit.`,
          "success",
          tx.hash
        );
        await loadData();
      } catch (error) {
        showToast("Approval failed", friendlyError(error), "error");
      } finally {
        setBusy(false);
      }
    }

    async function deposit() {
      if (!state.vaultWrite || !state.account) {
        showToast("Wallet not connected", "Connect MetaMask first.", "error");
        return;
      }

      const amount = parseAmount(els.depositInput);
      if (amount <= 0n) {
        showToast("Invalid amount", `Enter a ${state.assetSymbol} amount first.`, "error");
        return;
      }
      if (state.allowance < amount) {
        showToast("Approval required", `Approve ${state.assetSymbol} before depositing.`, "error");
        return;
      }

      setBusy(true, "Confirm deposit in your wallet…");
      try {
        const tx = await state.vaultWrite.deposit(amount, state.account);
        showToast("Deposit sent", "Waiting for confirmation…", "info", tx.hash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Deposit transaction reverted.");
        els.depositInput.value = "";
        showToast("Deposit confirmed", "frVLT shares were minted to your wallet.", "success", tx.hash);
        await loadData();
      } catch (error) {
        showToast("Deposit failed", friendlyError(error), "error");
      } finally {
        setBusy(false);
      }
    }

    async function withdraw() {
      if (!state.vaultWrite || !state.account) {
        showToast("Wallet not connected", "Connect MetaMask first.", "error");
        return;
      }

      const amount = parseAmount(els.withdrawInput);
      if (amount <= 0n) {
        showToast("Invalid amount", "Enter a WFUSE amount first.", "error");
        return;
      }
      if (amount > state.maxWithdraw) {
        showToast("Insufficient liquidity", "Amount exceeds the currently withdrawable balance.", "error");
        return;
      }

      setBusy(true, "Confirm withdrawal in your wallet…");
      try {
        const tx = await state.vaultWrite.withdraw(amount, state.account, state.account);
        showToast("Withdrawal sent", "Waiting for confirmation…", "info", tx.hash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Withdrawal transaction reverted.");
        els.withdrawInput.value = "";
        showToast("Withdrawal confirmed", "WFUSE was sent to your wallet.", "success", tx.hash);
        await loadData();
      } catch (error) {
        showToast("Withdrawal failed", friendlyError(error), "error");
      } finally {
        setBusy(false);
      }
    }

function buildVaultContracts() {
  state.vault = new ethers.Contract(CONFIG.vault, VAULT_ABI, state.provider);
  state.vaultWrite = new ethers.Contract(CONFIG.vault, VAULT_ABI, state.signer);
  state.wfuse = new ethers.Contract(CONFIG.wfuse, ERC20_ABI, state.provider);
  state.wfuseWrite = new ethers.Contract(CONFIG.wfuse, ERC20_ABI, state.signer);
  state.shares = new ethers.Contract(CONFIG.vault, ERC20_ABI, state.provider);
}

export function initVault() {
  els.approveBtn.addEventListener("click", approve);
  els.depositBtn.addEventListener("click", deposit);
  els.withdrawBtn.addEventListener("click", withdraw);

  for (const input of [els.depositInput, els.withdrawInput]) {
    input.addEventListener("input", sanitizeInput);
  }

  for (const button of els.vaultSwitchButtons) {
    button.addEventListener("click", () => switchVault(button.dataset.vault));
  }

  els.depositMaxBtn.addEventListener("click", () => {
    if (!state.account) return;
    els.depositInput.value = ethers.formatUnits(state.wfuseBalance, state.decimals);
    updateButtons();
    els.depositInput.focus();
  });

  els.withdrawMaxBtn.addEventListener("click", () => {
    if (!state.account) return;
    els.withdrawInput.value = ethers.formatUnits(state.maxWithdraw, state.decimals);
    updateButtons();
    els.withdrawInput.focus();
  });

  onWalletConnected(() => {
    buildVaultContracts();
    loadData();
  });

  setVaultLabels();
  resetReadState();
  updateNetworkBadge("disconnected");
  setSyncStatus("Loading public vault dataРІР‚В¦", "loading");
  loadPublicStats();
}

export {
  setVaultLabels,
  resetVaultContracts,
  switchVault,
  updateButtons,
  updateYourShare,
  renderStrategy,
  readVaultStats,
  updateStats,
  resetReadState,
  loadPublicStats,
  loadData,
  approve,
  deposit,
  withdraw
};
