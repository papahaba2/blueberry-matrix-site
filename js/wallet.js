import * as ethers from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import { CONFIG, FUSE_CHAIN } from "./config.js";
import {
  state,
  els,
  shortAddress,
  showToast,
  friendlyError,
  isUnknownChain,
  emitWalletConnected
} from "./core.js";

    async function ensureFuse(provider = state.walletProvider || window.ethereum) {
      if (!provider) throw new Error("No injected wallet found.");
      const current = await provider.request({ method: "eth_chainId" });
      if (String(current).toLowerCase() === CONFIG.chainIdHex) return;

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CONFIG.chainIdHex }]
        });
      } catch (error) {
        if (!isUnknownChain(error)) throw error;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [FUSE_CHAIN]
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CONFIG.chainIdHex }]
        });
      }
    }

    function rememberWallet(detail) {
      if (!detail?.provider || !detail?.info) return;
      const duplicate = state.wallets.some(
        (wallet) =>
          wallet.provider === detail.provider ||
          (detail.info.uuid && wallet.info.uuid === detail.info.uuid)
      );
      if (!duplicate) state.wallets.push(detail);
    }

    function initWalletDiscovery() {
      window.addEventListener("eip6963:announceProvider", (event) => {
        rememberWallet(event.detail);
      });
      window.dispatchEvent(new Event("eip6963:requestProvider"));

      // Compatibility fallback for wallets that have not implemented EIP-6963 yet.
      window.setTimeout(() => {
        if (!state.wallets.length && window.ethereum) {
          rememberWallet({
            info: { uuid: "legacy-injected", name: "Browser wallet", icon: "" },
            provider: window.ethereum
          });
        }
      }, 600);

      els.closeWalletModal.addEventListener("click", closeWalletModal);
      els.walletModal.addEventListener("click", (event) => {
        if (event.target === els.walletModal) closeWalletModal();
      });
    }

    function closeWalletModal() {
      els.walletModal.hidden = true;
    }

    function renderWalletList() {
      els.walletList.replaceChildren();
      for (const wallet of state.wallets) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "wallet-row";

        if (wallet.info.icon) {
          const icon = document.createElement("img");
          icon.src = wallet.info.icon;
          icon.alt = "";
          row.append(icon);
        } else {
          const avatar = document.createElement("span");
          avatar.className = "wallet-avatar";
          avatar.textContent = "W";
          row.append(avatar);
        }

        const info = document.createElement("span");
        info.className = "wallet-row-info";
        const name = document.createElement("span");
        name.className = "wallet-row-name";
        name.textContent = wallet.info.name || "Injected wallet";
        const detail = document.createElement("span");
        detail.className = "wallet-row-detail";
        detail.textContent = wallet.info.rdns || "EIP-6963 provider";
        info.append(name, detail);
        row.append(info);

        row.addEventListener("click", () => {
          closeWalletModal();
          connectWallet(wallet.provider);
        });
        els.walletList.append(row);
      }
    }

    function openWalletModal() {
      if (state.wallets.length === 1) {
        connectWallet(state.wallets[0].provider);
        return;
      }
      if (!state.wallets.length && window.ethereum) {
        rememberWallet({
          info: { uuid: "legacy-injected", name: "Browser wallet", icon: "" },
          provider: window.ethereum
        });
      }
      if (!state.wallets.length) {
        showToast(
          "No wallet found",
          "Install MetaMask or another EIP-6963 wallet, then refresh the page.",
          "error"
        );
        return;
      }
      renderWalletList();
      els.walletModal.hidden = false;
    }

    function attachWalletEvents(provider) {
      if (!provider?.on) return;
      provider.on("accountsChanged", () => window.location.reload());
      provider.on("chainChanged", () => window.location.reload());
    }

    function updateNetworkBadge(mode) {
      const connected = mode === "connected";
      const readOnly = mode === "readonly";
      els.networkBadge.classList.toggle("connected", connected);
      els.networkBadge.classList.toggle("readonly", readOnly);
      els.networkText.textContent = connected
        ? "Fuse Mainnet"
        : readOnly
          ? "Fuse Mainnet · read-only"
          : "Not connected";
    }

async function connectWallet(selectedProvider = null) {
  if (state.connecting) return;

  const injected = selectedProvider || state.walletProvider || window.ethereum;
  if (!injected) {
    openWalletModal();
    return;
  }

  state.walletProvider = injected;
  state.connecting = true;
  els.connectBtn.disabled = true;

  try {
    await injected.request({ method: "eth_requestAccounts" });
    await ensureFuse(injected);
    attachWalletEvents(injected);

    state.provider = new ethers.BrowserProvider(injected);
    state.signer = await state.provider.getSigner();
    state.account = await state.signer.getAddress();

    els.connectBtn.textContent = shortAddress(state.account);
    els.connectBtn.classList.add("connected");
    updateNetworkBadge("connected");
    showToast("Wallet connected", `Connected as ${shortAddress(state.account)}.`, "success");

    emitWalletConnected(state.account);
  } catch (error) {
    console.error(error);
    updateNetworkBadge("disconnected");
    showToast("Connection failed", friendlyError(error), "error");
  } finally {
    state.connecting = false;
    els.connectBtn.disabled = false;
  }
}

export function initWallet() {
  initWalletDiscovery();
  els.connectBtn.addEventListener("click", () => openWalletModal());
  window.setTimeout(() => {
    if (!state.wallets.length && window.ethereum) {
      rememberWallet({
        info: { uuid: "legacy-injected", name: "Browser wallet", icon: "" },
        provider: window.ethereum
      });
    }
  }, 600);
}

export {
  ensureFuse,
  rememberWallet,
  initWalletDiscovery,
  closeWalletModal,
  renderWalletList,
  openWalletModal,
  attachWalletEvents,
  updateNetworkBadge,
  connectWallet
};
