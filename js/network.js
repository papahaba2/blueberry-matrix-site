import { CONFIG } from "./config.js";
import { state, els } from "./core.js";

    const NETWORK_API = "https://explorer.fuse.io/api/v2";
    const NETWORK_CG = "https://api.coingecko.com/api/v3";
    const NETWORK_REFRESH_MS = 15000;
    const NETWORK_BLOCK_COUNT = 18;
    const NETWORK_COMPACT = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2
    });

    function fmtNetworkInt(value, digits = 0) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
      return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    }

    function fmtNetworkCompact(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
      return NETWORK_COMPACT.format(Number(value));
    }

    function fmtNetworkUsd(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
      const digits = Math.abs(Number(value)) >= 1 ? 4 : 6;
      return `$${Number(value).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })}`;
    }

    function fmtNetworkGwei(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
      return `${fmtNetworkInt(Number(value) / 1e9, 2)} gwei`;
    }

    function fmtNetworkBytes(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
      const bytes = Number(value);
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${Math.round(bytes)} B`;
    }

    function fmtNetworkAge(seconds) {
      if (!Number.isFinite(Number(seconds)) || seconds < 0) return "—";
      if (seconds < 60) return `${Math.round(seconds)}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      return `${Math.floor(minutes / 60)}h ago`;
    }

    function shortNetworkHash(hash) {
      if (!hash) return "—";
      return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
    }

    async function fetchNetworkJson(url, options = {}) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } finally {
        window.clearTimeout(timer);
      }
    }

    async function rpcCall(method, params = []) {
      const payload = await fetchNetworkJson(CONFIG.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      if (payload.error) throw new Error(payload.error.message || "RPC error");
      return payload.result;
    }

    function hexNumber(value) {
      if (typeof value === "string" && value.startsWith("0x")) return Number.parseInt(value, 16);
      return Number(value) || 0;
    }

    function parseNetworkBlock(raw) {
      if (!raw) return null;
      const transactions = Array.isArray(raw.transactions) ? raw.transactions : [];
      return {
        height: hexNumber(raw.number),
        hash: raw.hash || "",
        timestamp: hexNumber(raw.timestamp),
        miner: raw.miner || raw.author || "",
        txs: transactions,
        txCount: transactions.length,
        gasUsed: hexNumber(raw.gasUsed),
        gasLimit: hexNumber(raw.gasLimit),
        size: hexNumber(raw.size),
        baseFee: raw.baseFeePerGas ? hexNumber(raw.baseFeePerGas) : 0
      };
    }

    function networkSkeleton() {
      els.networkStats.innerHTML = Array.from({ length: 22 }, (_, index) => `
        <article class="card network-stat" style="--i:${index}">
          <div class="network-stat-label">Metric ${String(index + 1).padStart(2, "0")}</div>
          <div class="network-stat-value">—</div>
          <div class="network-stat-note">Waiting for data…</div>
        </article>`).join("");
      els.networkLive.textContent = "Connecting…";
      els.networkUpdated.textContent = "Waiting for first update…";
    }

    function renderNetworkStats(cards) {
      const escape = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char]));

      els.networkStats.innerHTML = cards.map((card, index) => `
        <article class="card network-stat" style="--i:${index}">
          <div class="network-stat-label">${escape(card.label)}</div>
          <div class="network-stat-value">${escape(card.value)}</div>
          <div class="network-stat-note ${card.tone || ""}">${escape(card.note || "—")}</div>
        </article>`).join("");
    }

    function renderNetworkHistogram(host, values, formatter) {
      if (!host) return;
      if (!values.length) {
        host.innerHTML = '<div class="network-empty">No blocks available.</div>';
        return;
      }
      const max = Math.max(...values, 1e-9);
      host.innerHTML = values.map((value, index) => {
        const height = Math.max(3, (value / max) * 100);
        return `<div class="hist-bar" style="--h:${height.toFixed(2)}%" title="Block ${index + 1}: ${formatter(value)}"></div>`;
      }).join("");
    }

    function renderNetworkFeed(blocks) {
      const rows = [];
      for (const block of blocks) {
        for (const tx of block.txs) {
          const object = typeof tx === "object" && tx !== null;
          let value = 0;
          if (object && tx.value) {
            try {
              value = Number(BigInt(tx.value)) / 1e18;
            } catch {
              value = 0;
            }
          }
          rows.push({
            hash: object ? tx.hash : String(tx),
            from: object ? tx.from : "",
            to: object ? tx.to : "",
            value,
            block: block.height,
            timestamp: block.timestamp
          });
          if (rows.length >= 14) break;
        }
        if (rows.length >= 14) break;
      }

      els.feedCount.textContent = `${rows.length} latest`;
      if (!rows.length) {
        els.txFeed.innerHTML = '<div class="network-empty">No transactions in the latest blocks.</div>';
        return;
      }

      const newest = blocks[0]?.timestamp || Math.floor(Date.now() / 1000);
      els.txFeed.innerHTML = rows.map((tx) => `
        <div class="tx-row">
          <div class="tx-hash">
            <a href="https://explorer.fuse.io/tx/${tx.hash}" target="_blank" rel="noreferrer">${shortNetworkHash(tx.hash)}</a>
            <small>#${fmtNetworkInt(tx.block)} · ${fmtNetworkAge(newest - tx.timestamp)}</small>
          </div>
          <div class="tx-route">
            ${tx.from ? shortNetworkHash(tx.from) : "unknown"} → <b>${tx.to ? shortNetworkHash(tx.to) : "contract"}</b>
          </div>
          <div class="tx-amount">${tx.value > 0 ? `${fmtNetworkInt(tx.value, 4)} FUSE` : "0 FUSE"}</div>
        </div>`).join("");
    }

    async function loadNetwork() {
      if (state.networkLoading) return;
      state.networkLoading = true;
      els.networkRefresh.disabled = true;
      els.networkLive.textContent = "Syncing…";

      try {
        const heightHex = await rpcCall("eth_blockNumber");
        const height = Number(BigInt(heightHex));
        const heights = Array.from({ length: NETWORK_BLOCK_COUNT }, (_, index) => height - index);

        const [rawBlocks, stats, pricePayload, gasPriceHex, priorityHex] = await Promise.all([
          Promise.all(
            heights.map((blockHeight) =>
              rpcCall("eth_getBlockByNumber", [`0x${blockHeight.toString(16)}`, true]).catch(() => null)
            )
          ),
          fetchNetworkJson(`${NETWORK_API}/stats`).catch(() => null),
          fetchNetworkJson(
            `${NETWORK_CG}/simple/price?ids=fuse-network-token&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
          ).catch(() => null),
          rpcCall("eth_gasPrice").catch(() => null),
          rpcCall("eth_maxPriorityFeePerGas").catch(() => null)
        ]);

        const blocks = rawBlocks.map(parseNetworkBlock).filter(Boolean);
        if (!blocks.length) throw new Error("No blocks returned");

        const newest = blocks[0];
        const oldest = blocks[blocks.length - 1];
        const span = Math.max(1, newest.timestamp - oldest.timestamp);
        const avgBlockTime = blocks.length > 1 ? span / (blocks.length - 1) : 0;
        const totalTx = blocks.reduce((sum, block) => sum + block.txCount, 0);
        const latestDelta = Math.max(1, newest.timestamp - (blocks[1]?.timestamp || newest.timestamp));
        const latestTps = newest.txCount / latestDelta;
        const avgTps = avgBlockTime > 0 ? totalTx / span : 0;
        const latestGasUtil = newest.gasLimit ? (newest.gasUsed / newest.gasLimit) * 100 : 0;
        const avgSize = blocks.reduce((sum, block) => sum + block.size, 0) / blocks.length;
        const uniqueAuthors = new Set(blocks.map((block) => block.miner).filter(Boolean)).size;
        const statsData = stats || {};
        const price = pricePayload?.["fuse-network-token"] || {};
        const totalSupply = statsData.total_supply
          ? Number(statsData.total_supply) / 1e18
          : price.usd_market_cap && price.usd
            ? Number(price.usd_market_cap) / Number(price.usd)
            : null;
        const change = Number(price.usd_24h_change);
        const gasPrice = gasPriceHex ? Number(gasPriceHex) : 0;
        const priorityFee = priorityHex ? Number(priorityHex) : 0;

        const tpsValues = blocks.slice().reverse().map((block, index, ordered) => {
          const previous = ordered[index - 1];
          const delta = previous ? Math.max(1, block.timestamp - previous.timestamp) : 0;
          return delta > 0 ? block.txCount / delta : 0;
        });
        const gasValues = blocks.slice().reverse().map((block) =>
          block.gasLimit ? (block.gasUsed / block.gasLimit) * 100 : 0
        );

        const cards = [
          {
            label: "FUSE Price",
            value: fmtNetworkUsd(price.usd),
            note: Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}% / 24h` : "CoinGecko quote"
          },
          {
            label: "24h Change",
            value: Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—",
            note: "USD · CoinGecko",
            tone: Number.isFinite(change) ? (change >= 0 ? "up" : "down") : ""
          },
          {
            label: "Market Cap",
            value: price.usd_market_cap ? `$${fmtNetworkCompact(price.usd_market_cap)}` : "—",
            note: "circulating market cap"
          },
          {
            label: "Circulating Supply",
            value: totalSupply ? `${fmtNetworkCompact(totalSupply)} FUSE` : "—",
            note: "Blockscout supply"
          },
          {
            label: "Chain Height",
            value: fmtNetworkInt(height),
            note: "latest block"
          },
          {
            label: "Total Blocks",
            value: fmtNetworkInt(statsData.total_blocks || height),
            note: "Blockscout index"
          },
          {
            label: "Block Time",
            value: avgBlockTime ? `${avgBlockTime.toFixed(2)} s` : "—",
            note: "last 18 blocks"
          },
          {
            label: "TPS · latest",
            value: fmtNetworkInt(latestTps, 2),
            note: `${fmtNetworkInt(newest.txCount)} txs in block`
          },
          {
            label: "TPS · average",
            value: fmtNetworkInt(avgTps, 2),
            note: "sample average"
          },
          {
            label: "Gas Utilization",
            value: `${fmtNetworkInt(latestGasUtil, 1)}%`,
            note: `${fmtNetworkCompact(newest.gasUsed)} gas used`
          },
          {
            label: "Base Fee",
            value: fmtNetworkGwei(newest.baseFee),
            note: "latest block"
          },
          {
            label: "Priority Fee",
            value: fmtNetworkGwei(priorityFee),
            note: "eth_maxPriorityFeePerGas"
          },
          {
            label: "Gas Price",
            value: fmtNetworkGwei(gasPrice),
            note: "eth_gasPrice"
          },
          {
            label: "Total Transactions",
            value: fmtNetworkCompact(statsData.total_transactions),
            note: "Blockscout index"
          },
          {
            label: "Addresses",
            value: fmtNetworkCompact(statsData.total_addresses),
            note: "unique addresses"
          },
          {
            label: "Latest Block Txs",
            value: fmtNetworkInt(newest.txCount),
            note: `#${fmtNetworkInt(newest.height)}`
          },
          {
            label: "Latest Block Size",
            value: fmtNetworkBytes(newest.size),
            note: "raw block size"
          },
          {
            label: "Average Block Size",
            value: fmtNetworkBytes(avgSize),
            note: "last 18 blocks"
          },
          {
            label: "Unique Authors",
            value: `${uniqueAuthors} / ${blocks.length}`,
            note: "block producers in sample"
          },
          {
            label: "Sample Transactions",
            value: fmtNetworkInt(totalTx),
            note: "last 18 blocks"
          },
          {
            label: "Network Client",
            value: statsData.client ? String(statsData.client).split("/")[0] : "Fuse EVM",
            note: "execution client"
          },
          {
            label: "Chain ID",
            value: "122",
            note: "Fuse Mainnet"
          }
        ];

        state.networkData = { height, blocks, cards };
        renderNetworkStats(cards);
        renderNetworkHistogram(els.tpsHistogram, tpsValues, (value) => `${value.toFixed(2)} TPS`);
        renderNetworkHistogram(els.gasHistogram, gasValues, (value) => `${value.toFixed(1)}% gas`);
        renderNetworkFeed(blocks);

        els.tpsNow.textContent = `${fmtNetworkInt(latestTps, 2)} TPS`;
        els.gasNow.textContent = `${fmtNetworkInt(latestGasUtil, 1)}%`;
        els.networkLive.textContent = "Live";
        els.networkUpdated.textContent = `Updated ${new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })}`;
        state.networkLoaded = true;
      } catch (error) {
        console.error(error);
        els.networkLive.textContent = "RPC error";
        els.networkUpdated.textContent = "Update failed · retrying automatically";
      } finally {
        state.networkLoading = false;
        els.networkRefresh.disabled = false;
      }
    }

    function startNetwork() {
      if (!state.networkLoaded) loadNetwork();
      if (state.networkTimer) return;
      state.networkTimer = window.setInterval(() => {
        if (els.networkView.classList.contains("active") && !state.networkLoading) {
          loadNetwork();
        }
      }, NETWORK_REFRESH_MS);
    }

    function stopNetwork() {
      if (state.networkTimer) {
        window.clearInterval(state.networkTimer);
        state.networkTimer = null;
      }
    }

    function initNetwork() {
      networkSkeleton();
      els.networkRefresh.addEventListener("click", loadNetwork);
    }

export { initNetwork, startNetwork, stopNetwork, loadNetwork };
