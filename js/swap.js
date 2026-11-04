import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import {
  CONFIG,
  TOKENS,
  TOKEN_LIST,
  ROUTER,
  QUOTER,
  SWAP_SLIPPAGE_BPS,
  ALGEBRA_DEPLOYER,
  ROUTER_ABI,
  QUOTER_ABI,
  ERC20_ABI
} from "./config.js";
import {
  state,
  els,
  showToast,
  setBusy,
  friendlyError,
  formatToken,
  formatAmount,
  ensurePublicProvider,
  onDataRefresh
} from "./core.js";
import { openWalletModal } from "./wallet.js";

    function parseSwapAmount() {
      const raw = els.fromAmount.value.trim().replace(",", ".");
      if (!raw || raw === ".") return 0n;
      try {
        return ethers.parseUnits(raw, state.swapFrom.decimals);
      } catch {
        return 0n;
      }
    }

    function clearSwapQuote() {
      state.swapSeq += 1;
      state.swapQuote = null;
      state.swapQuoteError = "";
      state.swapQuoteLoading = false;
      state.swapPriceImpact = null;
    }

    function sanitizeSwapInput() {
      let value = els.fromAmount.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
      const parts = value.split(".");
      if (parts.length > 2) {
        value = `${parts.shift()}.${parts.join("")}`;
      }
      const decimals = state.swapFrom.decimals;
      if (parts[1] && parts[1].length > decimals) {
        value = `${parts[0]}.${parts[1].slice(0, decimals)}`;
      }
      els.fromAmount.value = value;
      clearSwapQuote();
      updateSwapUI();
      window.clearTimeout(state.quoteTimer);
      state.quoteTimer = window.setTimeout(requestSwapQuote, 350);
    }

    function renderTokenButton(button, token) {
      const icon = button.querySelector(".token-icon");
      const symbol = button.querySelector(".token-symbol");
      if (icon) {
        icon.textContent = token.icon;
        icon.style.background = token.color;
        icon.style.color = "#ffffff";
      }
      if (symbol) symbol.textContent = token.symbol;
    }

    function tokenBalance(token) {
      if (!state.account) return null;
      if (token.address === state.swapFrom.address) return state.swapFromBalance;
      if (token.address === state.swapTo.address) return state.swapToBalance;
      return 0n;
    }

    function openTokenModal(side) {
      state.swapModalSide = side;
      els.tokenList.replaceChildren();

      for (const token of TOKEN_LIST) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "token-row";

        const icon = document.createElement("span");
        icon.className = "token-icon";
        icon.textContent = token.icon;
        icon.style.background = token.color;
        icon.style.color = "#ffffff";

        const info = document.createElement("span");
        info.className = "token-row-info";
        const symbol = document.createElement("span");
        symbol.className = "token-row-symbol";
        symbol.textContent = token.symbol;
        const name = document.createElement("span");
        name.className = "token-row-name";
        name.textContent = token.name;
        info.append(symbol, name);

        const balance = document.createElement("span");
        balance.className = "token-row-balance";
        const amount = tokenBalance(token);
        balance.textContent =
          amount === null ? "—" : `${formatAmount(amount, token.decimals)} ${token.symbol}`;

        row.append(icon, info, balance);
        row.addEventListener("click", () => {
          setSwapToken(side, token);
          closeTokenModal();
        });
        els.tokenList.append(row);
      }

      els.tokenModal.hidden = false;
      els.closeTokenModal.focus();
    }

    function closeTokenModal() {
      els.tokenModal.hidden = true;
    }

    function setSwapToken(side, token) {
      if (side === "from") {
        if (token.address === state.swapTo.address) {
          state.swapTo = state.swapFrom;
        }
        state.swapFrom = token;
      } else {
        if (token.address === state.swapFrom.address) {
          state.swapFrom = state.swapTo;
        }
        state.swapTo = token;
      }

      els.fromAmount.value = "";
      els.toAmount.value = "";
      clearSwapQuote();
      renderTokenButton(els.fromTokenBtn, state.swapFrom);
      renderTokenButton(els.toTokenBtn, state.swapTo);
      updateSwapUI();
      refreshSwapBalances();
    }

    function switchSwapTokens() {
      const previousQuote = state.swapQuote;
      [state.swapFrom, state.swapTo] = [state.swapTo, state.swapFrom];

      if (previousQuote !== null && previousQuote > 0n) {
        els.fromAmount.value = ethers.formatUnits(previousQuote, state.swapFrom.decimals);
      } else {
        els.fromAmount.value = "";
      }

      els.toAmount.value = "";
      clearSwapQuote();
      renderTokenButton(els.fromTokenBtn, state.swapFrom);
      renderTokenButton(els.toTokenBtn, state.swapTo);
      updateSwapUI();
      refreshSwapBalances();
      if (parseSwapAmount() > 0n) requestSwapQuote();
    }

    async function refreshSwapBalances() {
      if (!state.account) {
        state.swapFromBalance = 0n;
        state.swapToBalance = 0n;
        state.swapAllowance = 0n;
        updateSwapUI();
        return;
      }

      const from = state.swapFrom;
      const to = state.swapTo;
      try {
        const provider = ensurePublicProvider();
        const fromContract = new ethers.Contract(from.address, ERC20_ABI, provider);
        const toContract = new ethers.Contract(to.address, ERC20_ABI, provider);
        const [fromBalance, toBalance, allowance] = await Promise.all([
          fromContract.balanceOf(state.account),
          toContract.balanceOf(state.account),
          fromContract.allowance(state.account, ROUTER)
        ]);

        if (from.address !== state.swapFrom.address || to.address !== state.swapTo.address) {
          return;
        }

        state.swapFromBalance = fromBalance;
        state.swapToBalance = toBalance;
        state.swapAllowance = allowance;
        updateSwapUI();
      } catch (error) {
        console.error(error);
        state.swapFromBalance = 0n;
        state.swapToBalance = 0n;
        state.swapAllowance = 0n;
        updateSwapUI();
      }
    }

    async function requestSwapQuote() {
      const amount = parseSwapAmount();
      const from = state.swapFrom;
      const to = state.swapTo;

      if (amount <= 0n || from.address === to.address) {
        state.swapQuote = null;
        state.swapQuoteError = "";
        state.swapQuoteLoading = false;
        updateSwapUI();
        return;
      }

      const sequence = ++state.swapSeq;
      state.swapQuote = null;
      state.swapQuoteError = "";
      state.swapQuoteLoading = true;
      state.swapPriceImpact = null;
      updateSwapUI();

      try {
        const provider = ensurePublicProvider();
        const quoter = new ethers.Contract(QUOTER, QUOTER_ABI, provider);
        const probeAmount = amount / 100n > 1n ? amount / 100n : 1n;
        const [result, probe] = await Promise.all([
          quoter.quoteExactInputSingle.staticCall({
            tokenIn: from.address,
            tokenOut: to.address,
            deployer: ALGEBRA_DEPLOYER,
            amountIn: amount,
            limitSqrtPrice: 0
          }),
          quoter.quoteExactInputSingle.staticCall({
            tokenIn: from.address,
            tokenOut: to.address,
            deployer: ALGEBRA_DEPLOYER,
            amountIn: probeAmount,
            limitSqrtPrice: 0
          }).catch(() => null)
        ]);

        if (sequence !== state.swapSeq) return;
        state.swapQuote = result[0];

        const actualOut = Number(ethers.formatUnits(result[0], to.decimals));
        const probeOut = probe ? Number(ethers.formatUnits(probe[0], to.decimals)) : 0;
        const actualIn = Number(ethers.formatUnits(amount, from.decimals));
        const probeIn = Number(ethers.formatUnits(probeAmount, from.decimals));
        if (probe && actualOut > 0 && probeOut > 0 && actualIn > 0 && probeIn > 0 && probeAmount < amount) {
          const idealOut = (actualIn / probeIn) * probeOut;
          state.swapPriceImpact = Math.max(0, ((idealOut - actualOut) / idealOut) * 100);
        } else {
          state.swapPriceImpact = 0;
        }
      } catch (error) {
        if (sequence !== state.swapSeq) return;
        console.error(error);
        state.swapQuote = null;
        state.swapPriceImpact = null;
        state.swapQuoteError = "No route";
      } finally {
        if (sequence === state.swapSeq) {
          state.swapQuoteLoading = false;
          updateSwapUI();
        }
      }
    }
    function updateSwapUI() {
      const from = state.swapFrom;
      const to = state.swapTo;
      const amount = parseSwapAmount();
      const hasAccount = Boolean(state.account);
      const hasQuote =
        state.swapQuote !== null &&
        state.swapQuote > 0n &&
        !state.swapQuoteLoading &&
        !state.swapQuoteError;
      const needsApproval = hasAccount && amount > 0n && state.swapAllowance < amount;

      renderTokenButton(els.fromTokenBtn, from);
      renderTokenButton(els.toTokenBtn, to);

      els.fromBalanceLabel.textContent = hasAccount
        ? `Balance ${formatAmount(state.swapFromBalance, from.decimals)}`
        : "—";
      els.toBalanceLabel.textContent = hasAccount
        ? `Balance ${formatAmount(state.swapToBalance, to.decimals)}`
        : "—";
      els.fromBalanceHint.textContent = hasAccount
        ? `${formatAmount(state.swapFromBalance, from.decimals)} ${from.symbol} available`
        : "Connect a wallet to see balances";
      els.toBalanceHint.textContent = hasAccount
        ? `${formatAmount(state.swapToBalance, to.decimals)} ${to.symbol} available`
        : "";

      els.fromMaxBtn.disabled = !hasAccount || state.swapFromBalance === 0n || state.busy;

      if (hasQuote) {
        els.toAmount.value = formatAmount(state.swapQuote, to.decimals);
        const inAmount = Number(ethers.formatUnits(amount, from.decimals));
        const outAmount = Number(ethers.formatUnits(state.swapQuote, to.decimals));
        const rate = inAmount > 0 ? outAmount / inAmount : 0;
        els.swapRate.textContent = `1 ${from.symbol} = ${rate.toFixed(6)} ${to.symbol}`;

        const impact = state.swapPriceImpact;
        els.priceImpact.textContent = impact === null ? "—" : `${impact.toFixed(2)}%`;
        els.priceImpact.className = impact === null ? "" : impact >= 2 ? "bad" : impact >= 0.5 ? "warn" : "";

        const minOut = (state.swapQuote * BigInt(10000 - SWAP_SLIPPAGE_BPS)) / 10000n;
        els.minimumReceived.textContent = `${formatAmount(minOut, to.decimals)} ${to.symbol}`;
      } else {
        els.toAmount.value = "";
        els.swapRate.textContent = `1 ${from.symbol} = — ${to.symbol}`;
        els.priceImpact.textContent = "—";
        els.priceImpact.className = "";
        els.minimumReceived.textContent = "—";
      }

      let label = "Swap";
      let disabled = false;
      let status = "Ready to swap.";

      if (!hasAccount) {
        label = "Connect Wallet";
        status = "Connect a wallet to trade.";
      } else if (state.busy) {
        label = "Working…";
        disabled = true;
        status = "Confirm the transaction in your wallet.";
      } else if (amount <= 0n) {
        label = "Enter an amount";
        disabled = true;
        status = "Enter an amount to get a quote.";
      } else if (amount > state.swapFromBalance) {
        label = `Insufficient ${from.symbol}`;
        disabled = true;
        status = `You need more ${from.symbol} to swap.`;
      } else if (state.swapQuoteLoading || state.swapQuote === null) {
        label = "Fetching quote…";
        disabled = true;
        status = "Fetching the best Algebra price…";
      } else if (state.swapQuoteError) {
        label = "No route";
        disabled = true;
        status = "No route for this pair. Try another token or amount.";
      } else if (state.swapQuote <= 0n) {
        label = "No route";
        disabled = true;
        status = "No route for this pair. Try another token or amount.";
      } else if (needsApproval) {
        label = `Approve ${from.symbol}`;
        status = `Approve ${from.symbol} before swapping.`;
      } else {
        const minOut = (state.swapQuote * BigInt(10000 - SWAP_SLIPPAGE_BPS)) / 10000n;
        status = `Minimum received: ${formatAmount(minOut, to.decimals)} ${to.symbol}`;
      }

      els.swapBtn.textContent = label;
      els.swapBtn.disabled = disabled;
      els.swapStatus.textContent = status;
      els.swapSlippage.textContent = `${(SWAP_SLIPPAGE_BPS / 100).toFixed(2)}% slippage`;
    }

    async function approveSwap() {
      const amount = parseSwapAmount();
      if (!state.signer || !state.account || amount <= 0n) return;

      setBusy(true, `Confirm ${state.swapFrom.symbol} approval in your wallet…`);
      try {
        const token = new ethers.Contract(state.swapFrom.address, ERC20_ABI, state.signer);
        const tx = await token.approve(ROUTER, amount);
        showToast("Approval sent", "Waiting for confirmation…", "info", tx.hash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Approval transaction reverted.");
        showToast("Approval confirmed", `You can now swap ${state.swapFrom.symbol}.`, "success", tx.hash);
        await refreshSwapBalances();
        await requestSwapQuote();
      } catch (error) {
        console.error(error);
        showToast("Approval failed", friendlyError(error), "error");
      } finally {
        setBusy(false);
        updateSwapUI();
      }
    }

    async function executeSwap() {
      const amount = parseSwapAmount();
      if (!state.signer || !state.account || amount <= 0n) return;
      if (state.swapQuote === null || state.swapQuote <= 0n) return;

      const from = state.swapFrom;
      const to = state.swapTo;
      const amountOutMinimum = (state.swapQuote * BigInt(10000 - SWAP_SLIPPAGE_BPS)) / 10000n;
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

      setBusy(true, `Confirm ${from.symbol} → ${to.symbol} swap in your wallet…`);
      try {
        const router = new ethers.Contract(ROUTER, ROUTER_ABI, state.signer);
        const tx = await router.exactInputSingle({
          tokenIn: from.address,
          tokenOut: to.address,
          deployer: ALGEBRA_DEPLOYER,
          recipient: state.account,
          deadline,
          amountIn: amount,
          amountOutMinimum,
          limitSqrtPrice: 0
        });

        showToast("Swap sent", "Waiting for confirmation…", "info", tx.hash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Swap transaction reverted.");
        showToast("Swap confirmed", `${from.symbol} → ${to.symbol} completed.`, "success", tx.hash);

        els.fromAmount.value = "";
        clearSwapQuote();
        await Promise.all([refreshSwapBalances(), loadData(true)]);
      } catch (error) {
        console.error(error);
        showToast("Swap failed", friendlyError(error), "error");
      } finally {
        setBusy(false);
        updateSwapUI();
      }
    }

    /* ------------------------------- Network -------------------------------- */

export function initSwap() {
  renderTokenButton(els.fromTokenBtn, state.swapFrom);
  renderTokenButton(els.toTokenBtn, state.swapTo);

  els.fromAmount.addEventListener("input", sanitizeSwapInput);
  els.fromMaxBtn.addEventListener("click", () => {
    if (!state.account || state.swapFromBalance === 0n) return;
    els.fromAmount.value = ethers.formatUnits(state.swapFromBalance, state.swapFrom.decimals);
    clearSwapQuote();
    updateSwapUI();
    requestSwapQuote();
  });

  els.switchTokens.addEventListener("click", switchSwapTokens);
  els.fromTokenBtn.addEventListener("click", () => openTokenModal("from"));
  els.toTokenBtn.addEventListener("click", () => openTokenModal("to"));
  els.closeTokenModal.addEventListener("click", closeTokenModal);
  els.tokenModal.addEventListener("click", (event) => {
    if (event.target === els.tokenModal) closeTokenModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.tokenModal.hidden) closeTokenModal();
  });

  els.swapBtn.addEventListener("click", () => {
    if (!state.account) {
      openWalletModal();
      return;
    }
    const amount = parseSwapAmount();
    if (amount <= 0n || amount > state.swapFromBalance) return;
    if (state.swapAllowance < amount) {
      approveSwap();
    } else {
      executeSwap();
    }
  });

  onDataRefresh(async () => {
    await refreshSwapBalances();
    updateSwapUI();
  });

  // Direct bridge from wallet.js. This is deliberately a browser event so the
  // Swap module still updates even if the Vault module's RPC read fails.
  window.addEventListener("walletConnected", (event) => {
    const { account, signer, provider } = event.detail || {};
    if (account) state.account = account;
    if (signer) state.signer = signer;
    if (provider) state.provider = provider;
    refreshSwapBalances();
    updateSwapUI();
  });

  if (state.account) {
    refreshSwapBalances();
  }

  updateSwapUI();
}

export {
  parseSwapAmount,
  clearSwapQuote,
  sanitizeSwapInput,
  renderTokenButton,
  tokenBalance,
  openTokenModal,
  closeTokenModal,
  setSwapToken,
  switchSwapTokens,
  refreshSwapBalances,
  requestSwapQuote,
  updateSwapUI,
  approveSwap,
  executeSwap
};
