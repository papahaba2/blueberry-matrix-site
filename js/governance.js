import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import { CONFIG, BERRY_ABI } from "./config.js";
import {
  state,
  els,
  formatAmount,
  ensurePublicProvider,
  onDataRefresh
} from "./core.js";
import { openWalletModal } from "./wallet.js";

    function updateBerryUI() {
      const hasAccount = Boolean(state.account);
      const text = hasAccount ? formatAmount(state.berryBalance, state.berryDecimals) : "—";
      els.berryBalance.innerHTML = hasAccount ? `${text} <span class="unit">BERRY</span>` : "—";
      els.govBerryBalance.textContent = text;
      els.govVotingPower.textContent = hasAccount ? `${text} BERRY` : "—";
      els.govConnectBtn.textContent = hasAccount ? "Connected" : "Connect Wallet";
      els.govConnectBtn.disabled = hasAccount;
    }

    async function loadBerryData() {
      if (!state.account) {
        state.berryBalance = 0n;
        updateBerryUI();
        return;
      }

      try {
        const provider = ensurePublicProvider();
        const berry = new ethers.Contract(CONFIG.berry, BERRY_ABI, provider);
        const [balance, decimals] = await Promise.all([
          berry.balanceOf(state.account),
          berry.decimals().catch(() => 18)
        ]);
        state.berryBalance = balance;
        state.berryDecimals = Number(decimals);
        updateBerryUI();
      } catch (error) {
        console.error(error);
        state.berryBalance = 0n;
        updateBerryUI();
      }
    }
    async function loadGovernance() {
      updateBerryUI();
      if (state.account) {
        await loadBerryData();
      }
    }

export function initGovernance() {
  els.govConnectBtn.addEventListener("click", () => {
    if (!state.account) openWalletModal();
  });
  onDataRefresh(() => loadGovernance());
  loadGovernance();
}

export { updateBerryUI, loadBerryData, loadGovernance };
