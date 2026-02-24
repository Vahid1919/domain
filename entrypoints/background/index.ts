import {
  getTodayString,
  getLimitedSites,
  getBlockedSites,
  getUsageData,
  getAccountabilitySettings,
  extendLimit,
} from "@/lib/storage";
import type { LimitedSite, BlockedSite, UsageEntry } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import type { EmailEvent } from "@/lib/email";

// ── In-memory state ──────────────────────────────────────────────────────────
let usageCache: Record<string, UsageEntry> = {};
let limitedSitesCache: LimitedSite[] = [];
let blockedSitesCache: BlockedSite[] = [];

let activeTabId: number | null = null;
let currentDomain: string | null = null;
let windowFocused = true;

// ── Session timing (wall-clock based — immune to missed ticks) ───────────────
// Instead of incrementing by 1 each setInterval tick (unreliable in SW),
// we record when the session started and compute elapsed via Date.now().
// Missed ticks are automatically caught up on the next tick.
let sessionStartAt: number | null = null; // Date.now() when session began
let sessionBaseUsed = 0;                  // usedSeconds at session start
let lastFlushAt = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function findLimitedSite(domain: string): LimitedSite | undefined {
  return limitedSitesCache.find(
    (s) => domain === s.domain || domain.endsWith("." + s.domain),
  );
}

function isBlockedSite(domain: string): boolean {
  return blockedSitesCache.some(
    (s) => domain === s.domain || domain.endsWith("." + s.domain),
  );
}

function ensureUsageToday(domain: string): void {
  const today = getTodayString();
  if (!usageCache[domain] || usageCache[domain].date !== today) {
    usageCache[domain] = { date: today, usedSeconds: 0 };
  }
}

async function flushCache(): Promise<void> {
  await chrome.storage.local.set({ usageData: usageCache });
  lastFlushAt = Date.now();
}

async function dispatchEmail(event: EmailEvent, domain: string): Promise<void> {
  try {
    const settings = await getAccountabilitySettings();
    await sendEmail(settings, event, domain);
  } catch {
    /* silent */
  }
}

// ── Session management ────────────────────────────────────────────────────────
function beginTracking(domain: string): void {
  ensureUsageToday(domain);
  sessionBaseUsed = usageCache[domain].usedSeconds;
  sessionStartAt = Date.now();
  currentDomain = domain;
}

/** Snapshot elapsed time into cache without clearing session. */
function snapshotSession(): void {
  if (currentDomain && sessionStartAt !== null) {
    const elapsed = Math.round((Date.now() - sessionStartAt) / 1000);
    ensureUsageToday(currentDomain);
    usageCache[currentDomain].usedSeconds = sessionBaseUsed + elapsed;
  }
}

/** Stop tracking: snapshot then clear. */
function pauseTracking(): void {
  snapshotSession();
  currentDomain = null;
  sessionStartAt = null;
  sessionBaseUsed = 0;
}

// ── Tick (every second) ───────────────────────────────────────────────────────
function onTick(): void {
  if (!currentDomain || !windowFocused || activeTabId === null) return;

  // Session not started yet (e.g. SW just woke up) — begin now
  if (sessionStartAt === null) {
    beginTracking(currentDomain);
    return;
  }

  const site = findLimitedSite(currentDomain);
  if (!site) {
    pauseTracking();
    return;
  }

  // Elapsed is computed from wall-clock, so missed ticks never cause drift
  const elapsed = Math.round((Date.now() - sessionStartAt) / 1000);
  ensureUsageToday(currentDomain);
  const usedSeconds = sessionBaseUsed + elapsed;
  usageCache[currentDomain].usedSeconds = usedSeconds;

  const limitSeconds = site.limitMinutes * 60;
  const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);

  chrome.tabs
    .sendMessage(activeTabId, {
      type: "TIME_UPDATE",
      domain: currentDomain,
      usedSeconds,
      limitSeconds,
      remainingSeconds,
    })
    .catch(() => {});

  // Flush every 10 s to keep storage fresh without hammering disk
  if (Date.now() - lastFlushAt > 10_000) void flushCache();

  if (remainingSeconds <= 0) {
    const domain = currentDomain;
    const tabId = activeTabId;
    pauseTracking();
    void flushCache();
    void dispatchEmail("limit_exceeded", domain);
    void chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(
        "blocked.html?domain=" + encodeURIComponent(domain) + "&type=limit",
      ),
    });
  }
}

// ── Active tab management ─────────────────────────────────────────────────────
async function updateActiveTab(tabId: number, url?: string): Promise<void> {
  // Switching tabs — snapshot the outgoing session
  if (activeTabId !== tabId) {
    snapshotSession();
    sessionStartAt = null;
    sessionBaseUsed = 0;
  }

  activeTabId = tabId;

  if (!url) {
    try {
      const tab = await chrome.tabs.get(tabId);
      url = tab.url;
    } catch {
      currentDomain = null;
      return;
    }
  }
  if (!url || url.startsWith(chrome.runtime.getURL(""))) {
    currentDomain = null;
    return;
  }

  const domain = extractDomain(url);
  if (!domain) {
    currentDomain = null;
    return;
  }

  if (isBlockedSite(domain)) {
    currentDomain = null;
    void chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(
        "blocked.html?domain=" + encodeURIComponent(domain) + "&type=blocked",
      ),
    });
    return;
  }

  const site = findLimitedSite(domain);
  if (!site) {
    currentDomain = null;
    return;
  }

  ensureUsageToday(domain);
  const usedSeconds = usageCache[domain].usedSeconds;
  const limitSeconds = site.limitMinutes * 60;

  if (usedSeconds >= limitSeconds) {
    currentDomain = null;
    void flushCache();
    void chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(
        "blocked.html?domain=" + encodeURIComponent(domain) + "&type=limit",
      ),
    });
    return;
  }

  // Begin session if window is focused, otherwise just track domain for later
  if (windowFocused) {
    beginTracking(domain);
  } else {
    currentDomain = domain;
    sessionStartAt = null;
    sessionBaseUsed = usedSeconds;
  }

  // Push current state to the content script immediately
  chrome.tabs
    .sendMessage(tabId, {
      type: "TIME_UPDATE",
      domain,
      usedSeconds,
      limitSeconds,
      remainingSeconds: limitSeconds - usedSeconds,
    })
    .catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────────────────────
export default defineBackground(async () => {
  const [usage, limitedSites, blockedSites] = await Promise.all([
    getUsageData(),
    getLimitedSites(),
    getBlockedSites(),
  ]);
  usageCache = usage;
  limitedSitesCache = limitedSites;
  blockedSitesCache = blockedSites;

  const today = getTodayString();
  for (const domain of Object.keys(usageCache)) {
    if (usageCache[domain].date !== today) {
      usageCache[domain] = { date: today, usedSeconds: 0 };
    }
  }

  // Query real window focus state — don't assume focused on SW restart
  try {
    const wins = await chrome.windows.getAll({ populate: false });
    windowFocused = wins.some((w) => w.focused);
  } catch {
    windowFocused = true;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url) await updateActiveTab(tab.id, tab.url);

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void updateActiveTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId !== activeTabId) return;
    // React on explicit URL change or when page finishes loading (covers SPAs,
    // hash changes handled by the content script re-requesting state)
    if (changeInfo.url || changeInfo.status === "complete") {
      void updateActiveTab(tabId, changeInfo.url);
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    const nowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
    if (nowFocused === windowFocused) return;

    if (!nowFocused) {
      // Losing focus: snapshot elapsed and pause
      snapshotSession();
      sessionStartAt = null;
      void flushCache();
    } else if (currentDomain) {
      // Gaining focus: resume session from current usage
      sessionBaseUsed = usageCache[currentDomain]?.usedSeconds ?? 0;
      sessionStartAt = Date.now();
    }

    windowFocused = nowFocused;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.limitedSites) {
      limitedSitesCache =
        (changes.limitedSites.newValue as LimitedSite[] | undefined) ?? [];
      if (currentDomain && !findLimitedSite(currentDomain)) {
        currentDomain = null;
        sessionStartAt = null;
      }
    }
    if (changes.blockedSites) {
      blockedSitesCache =
        (changes.blockedSites.newValue as BlockedSite[] | undefined) ?? [];
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_USAGE") {
      const todayStr = getTodayString();
      const out: Record<string, number> = {};
      // Include live elapsed for active domain
      if (currentDomain && sessionStartAt !== null) snapshotSession();
      for (const [domain, entry] of Object.entries(usageCache)) {
        if (entry.date === todayStr) out[domain] = entry.usedSeconds;
      }
      sendResponse(out);
      return true;
    }

    if (msg.type === "GET_CURRENT_STATE") {
      const tabId = sender.tab?.id;
      if (tabId === activeTabId && currentDomain) {
        const site = findLimitedSite(currentDomain);
        if (site) {
          ensureUsageToday(currentDomain);
          const elapsed =
            sessionStartAt !== null
              ? Math.round((Date.now() - sessionStartAt) / 1000)
              : 0;
          const usedSeconds = sessionBaseUsed + elapsed;
          const limitSeconds = site.limitMinutes * 60;
          sendResponse({
            type: "TIME_UPDATE",
            domain: currentDomain,
            usedSeconds,
            limitSeconds,
            remainingSeconds: Math.max(0, limitSeconds - usedSeconds),
          });
          return true;
        }
      }
      sendResponse(null);
      return true;
    }

    if (msg.type === "EXTEND_LIMIT") {
      const domain = msg.domain as string;
      const minutes = (msg.minutes as number) ?? 5;
      extendLimit(domain, minutes).then(async (ok) => {
        if (ok) {
          limitedSitesCache = await getLimitedSites();
          void dispatchEmail("limit_extended", domain);
          // Re-evaluate the active tab so a blocked page can be dismissed
          if (activeTabId !== null) void updateActiveTab(activeTabId);
        }
        sendResponse({ ok });
      });
      return true;
    }

    if (msg.type === "EMAIL_EVENT") {
      void dispatchEmail(msg.event as EmailEvent, msg.domain as string);
      sendResponse({ queued: true });
      return true;
    }

    if (msg.type === "RESET_USAGE") {
      const domain = msg.domain as string;
      delete usageCache[domain];
      if (currentDomain === domain) {
        sessionStartAt = null;
        sessionBaseUsed = 0;
      }
      void flushCache();
      sendResponse({ ok: true });
      return true;
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "keepalive") return;
    port.onDisconnect.addListener(() => {});
  });

  chrome.alarms.create("flush", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "flush") void flushCache();
  });

  setInterval(onTick, 1000);
});
