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
                    setTimeout(connectPort, 2000);
                    // Re-request state after reconnect — SW may have restarted
                    setTimeout(requestState, 2200);
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
        let dotEl: HTMLSpanElement | null = null;
        let dismissed = false;
        // Wall-clock sync anchor — drift-proof local interpolation
        let localSyncAt = 0;       // Date.now() at last real TIME_UPDATE
        let localRemAtSync = 0;    // remainingSeconds at that moment
        let localLimitSeconds = 0; // limitSeconds from last sync — needed to compute % used for the progress bar
        let localInterval: ReturnType<typeof setInterval> | null = null;
        let lastUpdateAt = 0;      // for stale-state detection

        // ── Helpers ────────────────────────────────────────────────────────────
        function fmt(secs: number): string {
            if (secs <= 0) return "0:00";
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            if (h > 0) return `${h}:${String(m).padStart(2, "0")}h`;
            return `${m}:${String(s).padStart(2, "0")}`;
        }

        function fmtLimit(secs: number): string {
            if (secs <= 0) return "0m";
            const h = Math.floor(secs / 3600);
            const m = Math.ceil((secs % 3600) / 60);
            if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
            return `${m}m`;
        }

        type Theme = { accent: string; glow: string; pulse: boolean };
        function theme(pctUsed: number): Theme {
            if (pctUsed >= 95)
                return { accent: "#22d3ee", glow: "rgba(34,211,238,0.38)", pulse: true };
            if (pctUsed >= 80)
                return { accent: "#f59e0b", glow: "rgba(245,158,11,0.28)", pulse: false };
            return { accent: "#d4d4d8", glow: "rgba(212,212,216,0.18)", pulse: false };
        }

        // ── Build shadow DOM toast ─────────────────────────────────────────────
        function buildToast() {
            const host = document.createElement("div");
            host.id = "__killswitch_toast__";
            host.style.cssText =
                "all:initial;position:fixed;top:12px;right:12px;z-index:2147483647;pointer-events:none;";

            const shadow = host.attachShadow({ mode: "open" });

            const style = document.createElement("style");
            style.textContent = `
        @keyframes slideIn {
          from { opacity:0; transform:translateY(-6px) scale(0.96); }
          to   { opacity:1; transform:translateY(0)   scale(1); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.3; }
        }
        .toast {
          pointer-events: auto;
          width: 110px;
          background: rgba(9,11,20,0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(34,211,238,0.13);
          border-radius: 8px;
          font-family: -apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;
          color: #e2e8f0;
          box-shadow: 0 4px 18px rgba(0,0,0,0.45);
          animation: slideIn 0.16s cubic-bezier(0.22,1,0.36,1);
          transition: box-shadow 0.3s;
          user-select: none;
          overflow: hidden;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 6px 4px;
        }
        .dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: background 0.3s;
        }
        .dot.pulse { animation: pulse 1.2s infinite; }
        .time {
          flex: 1;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          transition: color 0.3s;
        }
        .sep { font-size: 10px; color: rgba(255,255,255,0.2); }
        .limit {
          font-size: 10px;
          font-weight: 400;
          color: rgba(255,255,255,0.35);
          flex-shrink: 0;
        }
        .close {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.25);
          font-size: 10px; line-height: 1;
          padding: 2px 3px; border-radius: 4px;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0; margin-left: 1px;
        }
        .close:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }
        .track { height: 2px; background: rgba(255,255,255,0.07); }
        .bar { height: 100%; transition: width 0.9s ease, background 0.3s; }
      `;
            shadow.appendChild(style);

            const card = document.createElement("div");
            card.className = "toast";

            const row = document.createElement("div");
            row.className = "row";

            dotEl = document.createElement("span");
            dotEl.className = "dot";

            timeText = document.createElement("span");
            timeText.className = "time";

            const sepEl = document.createElement("span");
            sepEl.className = "sep";
            sepEl.textContent = "/";

            const limitText = document.createElement("span");
            limitText.className = "limit";

            const closeBtn = document.createElement("button");
            closeBtn.className = "close";
            closeBtn.innerHTML = "&#x2715;";
            closeBtn.onclick = () => {
                dismissed = true;
                if (localInterval) clearInterval(localInterval);
                host.remove();
                toastHost = null;
            };

            row.appendChild(dotEl);
            row.appendChild(timeText);
            row.appendChild(sepEl);
            row.appendChild(limitText);
            row.appendChild(closeBtn);

            const track = document.createElement("div");
            track.className = "track";
            progressBar = document.createElement("div");
            progressBar.className = "bar";
            progressBar.style.width = "0%";
            track.appendChild(progressBar);

            card.appendChild(row);
            card.appendChild(track);
            shadow.appendChild(card);

            toastHost = host;
            (document.body ?? document.documentElement).appendChild(host);
        }

        // ── Apply update to DOM ────────────────────────────────────────────────
        function applyToDOM(
            usedSeconds: number,
            limitSeconds: number,
            remainingSeconds: number,
        ) {
            const pct = Math.min(100, (usedSeconds / limitSeconds) * 100);
            const t = theme(pct);

            if (progressBar) {
                progressBar.style.width = `${pct.toFixed(1)}%`;
                progressBar.style.background = t.accent;
            }
            // Show remaining time — more actionable than elapsed
            if (timeText) {
                timeText.textContent = fmt(remainingSeconds);
                timeText.style.color = t.accent;
            }
            const limitEl = toastHost?.shadowRoot?.querySelector<HTMLElement>(".limit");
            if (limitEl) limitEl.textContent = fmtLimit(limitSeconds);
            if (dotEl) {
                dotEl.style.background = t.accent;
                dotEl.className = `dot${t.pulse ? " pulse" : ""}`;
            }
            const card = toastHost?.shadowRoot?.querySelector<HTMLDivElement>(".toast");
            if (card) {
                card.style.boxShadow = `0 4px 20px rgba(0,0,0,0.55), 0 0 16px ${t.glow}`;
            }
        }

        // ── Request current state from SW ─────────────────────────────────────
        function requestState() {
            if (dismissed) return;
            chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
                if (chrome.runtime.lastError || !response?.domain) return;
                handleUpdate(response);
            });
        }

        // ── Handle an incoming time update ────────────────────────────────────
        function handleUpdate(data: {
            domain: string;
            usedSeconds: number;
            limitSeconds: number;
            remainingSeconds: number;
        }) {
            if (dismissed) return;

            // Anchor wall-clock sync point — local interval interpolates from here
            localSyncAt = Date.now();
            localRemAtSync = data.remainingSeconds;
            localLimitSeconds = data.limitSeconds;
            lastUpdateAt = Date.now();

            if (!toastHost) buildToast();
            applyToDOM(data.usedSeconds, data.limitSeconds, data.remainingSeconds);

            // Restart drift-correcting local interval
            if (localInterval) clearInterval(localInterval);
            localInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - localSyncAt) / 1000);
                const remaining = Math.max(0, localRemAtSync - elapsed);
                if (remaining <= 0) {
                    clearInterval(localInterval!);
                    return;
                }
                const used = localLimitSeconds - remaining;
                applyToDOM(used, localLimitSeconds, remaining);
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
        requestState();

        // ── Re-sync when tab becomes visible (switch back, unminimize) ────────
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) requestState();
        });

        // ── Periodic re-sync: catches SW restart / stale toast ────────────────
        setInterval(() => {
            if (dismissed || !toastHost) return;
            if (Date.now() - lastUpdateAt > 5_000) requestState();
        }, 5_000);
    },
});
