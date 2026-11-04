import { initWallet } from "./wallet.js";
import { initVault, loadData, loadPublicStats } from "./vault.js";
import { initSwap, refreshSwapBalances, updateSwapUI } from "./swap.js";
import { initNetwork, startNetwork, stopNetwork } from "./network.js";
import { initGovernance, loadGovernance } from "./governance.js";
import {
  state,
  els,
  applyTheme,
  readStoredTheme,
  toggleTheme
} from "./core.js";

    function initReveal() {
      const nodes = Array.from(
        document.querySelectorAll(
          "[data-reveal], .landing-section, .roadmap-card, .vault-overview"
        )
      );
      if (!nodes.length) return;

      nodes.forEach((node) => node.setAttribute("data-reveal", ""));

      if (!("IntersectionObserver" in window)) {
        nodes.forEach((node) => node.classList.add("revealed"));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );

      nodes.forEach((node) => observer.observe(node));
    }

    function switchPage(page) {
      const isApp = page === "app";
      document.body.classList.toggle("app", isApp);
      document.body.classList.toggle("landing", !isApp);
      els.landingView.classList.toggle("active", !isApp);
      els.appView.classList.toggle("active", isApp);
      els.landingView.hidden = isApp;
      els.appView.hidden = !isApp;

      if (isApp) {
        const hasActive = [els.vaultView, els.swapView, els.networkView, els.governanceView].some((view) =>
          view.classList.contains("active")
        );
        if (!hasActive) {
          els.vaultView.classList.add("active");
          els.tabs.forEach((tab) => {
            const active = tab.dataset.view === "vault";
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
          });
        }
      } else {
        stopNetwork();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function initPage() {
      els.launchApp.addEventListener("click", () => switchPage("app"));
      els.homeBtn.addEventListener("click", () => switchPage("landing"));
      switchPage("landing");
    }

    function switchView(name) {
      const next =
        name === "swap"
          ? els.swapView
          : name === "network"
            ? els.networkView
            : name === "governance"
              ? els.governanceView
              : els.vaultView;
      const current =
        [els.vaultView, els.swapView, els.networkView, els.governanceView].find((view) =>
          view.classList.contains("active")
        ) || els.vaultView;
      if (next === current) return;

      els.tabs.forEach((tab) => {
        const active = tab.dataset.view === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });

      current.classList.add("leaving");
      window.setTimeout(() => {
        current.classList.remove("active", "leaving");
        next.classList.add("active");
      }, 180);

      if (name === "swap") {
        stopNetwork();
        refreshSwapBalances();
        updateSwapUI();
      } else if (name === "network") {
        startNetwork();
      } else if (name === "governance") {
        stopNetwork();
        loadGovernance();
      } else {
        stopNetwork();
      }
    }

function initApp() {
  initWallet();
  initVault();
  initSwap();
  initNetwork();
  initGovernance();
  initPage();
  initReveal();

  applyTheme(readStoredTheme());
  els.themeBtn.addEventListener("click", toggleTheme);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || state.busy) return;
    if (state.account) {
      loadData();
    } else {
      loadPublicStats();
    }
  });

  document.documentElement.dataset.appReady = "true";
}

initApp();

export { initApp, switchPage, switchView };
