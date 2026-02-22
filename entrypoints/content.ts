export default defineContentScript({
    matches: ["<all_urls>"],
    runAt: "document_idle",

    main() {
        // Don't run on the extension's own pages
        if (location.href.startsWith(chrome.runtime.getURL(""))) return;

        // ── Keep service worker alive ──────────────────────────────────────────
        let port: chrome.runtime.Port | null = null;

        function connectPort() {
            try {
                port = chrome.runtime.connect({ name: "keepalive" });
                port.onDisconnect.addListener(() => {
                    port = null;
                    // Re-connect after a short delay if the page is still open
                    setTimeout(connectPort, 2000);
                });
            } catch {
                /* extension may have been reloaded */
            }
        }
        connectPort();

        // ── State ──────────────────────────────────────────────────────────────
        let toastHost: HTMLElement | null = null;
        let progressBar: HTMLDivElement | null = null;
        let timeText: HTMLSpanElement | null = null;
        let pctText: HTMLSpanElement | null = null;
        let domainEl: HTMLSpanElement | null = null;
        let dotEl: HTMLSpanElement | null = null;
        let dismissed = false;
        let localRemaining = 0;
        let localLimitSeconds = 0;
        let localUsedSeconds = 0;
        let localInterval: ReturnType<typeof setInterval> | null = null;

        // ── Helpers ────────────────────────────────────────────────────────────
        function fmt(secs: number): string {
            if (secs <= 0) return "0s";
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        }

        type Theme = { accent: string; glow: string; pulse: boolean };
        function theme(pct: number): Theme {
            if (pct >= 95)
                return {
                    accent: "#ef4444",
                    glow: "rgba(239,68,68,0.35)",
                    pulse: true,
                };
            if (pct >= 80)
                return {
                    accent: "#f97316",
                    glow: "rgba(249,115,22,0.25)",
                    pulse: false,
                };
            return {
                accent: "#3b82f6",
                glow: "rgba(59,130,246,0.2)",
                pulse: false,
            };
        }

        // ── Build shadow DOM toast ─────────────────────────────────────────────
        function buildToast() {
            const host = document.createElement("div");
            host.id = "__blkr_toast__";
            host.style.cssText =
                "all:initial;position:fixed;bottom:24px;right:24px;z-index:2147483647;pointer-events:none;";

            const shadow = host.attachShadow({ mode: "open" });

            const style = document.createElement("style");
            style.textContent = `
        @keyframes slideIn {
          from { opacity:0; transform:translateY(8px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)  scale(1); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.35; }
        }
        .toast {
          pointer-events: auto;
          width: 268px;
          background: rgba(9,11,20,0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 13px 14px 11px;
          font-family: -apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;
          font-size: 13px;
          color: #e2e8f0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.55);
          animation: slideIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
          transition: box-shadow 0.35s;
          user-select: none;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 9px;
        }
        .title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: -0.01em;
          min-width: 0;
        }
        .domain {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: background 0.3s;
        }
        .dot.pulse { animation: pulse 1s infinite; }
        .close {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          font-size: 14px;
          line-height: 1;
          padding: 3px 5px;
          border-radius: 5px;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .close:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.07); }
        .track {
          height: 5px;
          background: rgba(255,255,255,0.09);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .bar {
          height: 100%;
          border-radius: 99px;
          transition: width 0.9s ease, background 0.3s;
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .remaining {
          font-size: 12px;
          font-weight: 500;
          color: #e2e8f0;
        }
        .pct {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
        }
      `;
            shadow.appendChild(style);

            const card = document.createElement("div");
            card.className = "toast";

            // Header
            const header = document.createElement("div");
            header.className = "header";

            const titleEl = document.createElement("div");
            titleEl.className = "title";

            dotEl = document.createElement("span");
            dotEl.className = "dot";

            domainEl = document.createElement("span");
            domainEl.className = "domain";

            titleEl.appendChild(dotEl);
            titleEl.appendChild(domainEl);

            const closeBtn = document.createElement("button");
            closeBtn.className = "close";
            closeBtn.innerHTML = "&#x2715;";
            closeBtn.onclick = () => {
                dismissed = true;
                if (localInterval) clearInterval(localInterval);
                host.remove();
                toastHost = null;
            };

            header.appendChild(titleEl);
            header.appendChild(closeBtn);

            // Progress track
            const track = document.createElement("div");
            track.className = "track";
            progressBar = document.createElement("div");
            progressBar.className = "bar";
            progressBar.style.width = "0%";
            track.appendChild(progressBar);

            // Footer
            const footer = document.createElement("div");
            footer.className = "footer";

            timeText = document.createElement("span");
            timeText.className = "remaining";

            pctText = document.createElement("span");
            pctText.className = "pct";

            footer.appendChild(timeText);
            footer.appendChild(pctText);

            card.appendChild(header);
            card.appendChild(track);
            card.appendChild(footer);
            shadow.appendChild(card);

            toastHost = host;
            (document.body ?? document.documentElement).appendChild(host);
        }

        // ── Apply update to DOM ────────────────────────────────────────────────
        function applyToDOM(
            usedSeconds: number,
            limitSeconds: number,
            remainingSeconds: number,
            domain?: string,
        ) {
            const pct = Math.min(100, (usedSeconds / limitSeconds) * 100);
            const t = theme(pct);

            if (domain && domainEl) domainEl.textContent = domain;
            if (progressBar) {
                progressBar.style.width = `${pct.toFixed(1)}%`;
                progressBar.style.background = t.accent;
            }
            if (timeText) timeText.textContent = `${fmt(remainingSeconds)} left`;
            if (pctText) pctText.textContent = `${Math.round(pct)}%`;
            if (dotEl) {
                dotEl.style.background = t.accent;
                dotEl.className = `dot${t.pulse ? " pulse" : ""}`;
            }
            // Update glow based on urgency
            const card = toastHost?.shadowRoot?.querySelector<HTMLDivElement>(".toast");
            if (card) {
                card.style.boxShadow = `0 8px 32px rgba(0,0,0,0.55), 0 0 24px ${t.glow}`;
            }
        }

        // ── Handle an incoming time update ────────────────────────────────────
        function handleUpdate(data: {
            domain: string;
            usedSeconds: number;
            limitSeconds: number;
            remainingSeconds: number;
        }) {
            if (dismissed) return;

            localRemaining = data.remainingSeconds;
            localLimitSeconds = data.limitSeconds;
            localUsedSeconds = data.usedSeconds;

            if (!toastHost) buildToast();

            applyToDOM(
                data.usedSeconds,
                data.limitSeconds,
                data.remainingSeconds,
                data.domain,
            );

            // Reset local interval so it stays in sync with background ticks
            if (localInterval) clearInterval(localInterval);
            localInterval = setInterval(() => {
                if (localRemaining <= 0) {
                    clearInterval(localInterval!);
                    return;
                }
                localRemaining -= 1;
                localUsedSeconds += 1;
                applyToDOM(localUsedSeconds, localLimitSeconds, localRemaining);
            }, 1000);
        }

        // ── Listen for background messages ────────────────────────────────────
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "TIME_UPDATE") {
                handleUpdate(msg as {
                    domain: string;
                    usedSeconds: number;
                    limitSeconds: number;
                    remainingSeconds: number;
                });
            }
        });

        // ── Request initial state ─────────────────────────────────────────────
        chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
            if (chrome.runtime.lastError || !response?.domain) return;
            handleUpdate(response);
        });
    },
});
