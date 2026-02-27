import {
  getTodayString,
  getLimitedSites,
  getBlockedSites,
  getUsageData,
  getAccountabilitySettings,
  extendLimit,
} from "@/lib/storage";
import type { LimitedSite, BlockedSite, UsageEntry } from "@/lib/storage";
import { sendEmail, getEmailjsCredentials } from "@/lib/email";
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

// ── Uninstall URL ─────────────────────────────────────────────────────────────
// Build the uninstall redirect URL from current accountability settings so the
// hosted page can email the accountability partner when the extension is removed.
async function updateUninstallURL(): Promise<void> {
  const UNINSTALL_BASE = "https://vahid1919.github.io/domain/uninstall/";
  const { serviceId, templateId, publicKey } = getEmailjsCredentials();
  const settings = await getAccountabilitySettings();

  const params = new URLSearchParams();
  if (settings.email && settings.notifyOnUninstall) {
    params.set("to", settings.email);
    params.set("u", settings.name);
  }
  if (serviceId) params.set("sid", serviceId);
  if (templateId) params.set("tid", templateId);
  if (publicKey) params.set("key", publicKey);

  try {
    chrome.runtime.setUninstallURL(`${UNINSTALL_BASE}?${params.toString()}`);
  } catch {
    /* not available in all contexts */
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
async function onTick(): Promise<void> {
  // ── Active tab ────────────────────────────────────────────────────────────
  // Count whenever a limited site is the active tab, regardless of whether
  // the Chrome window itself is in the foreground — so e.g. YouTube playing
  // while the user is working in another app is still tracked.
  if (currentDomain && activeTabId !== null) {
    if (sessionStartAt === null) {
      // Anchor the wall-clock session on first tick after SW wake-up.
      beginTracking(currentDomain);
    } else {
      const site = findLimitedSite(currentDomain);
      if (!site) {
        pauseTracking();
      } else {
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
          .catch(() => { });

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
    }
  }

  // ── Audible background tabs ───────────────────────────────────────────────
  // Also count tabs actively playing audio/video even when not the active tab
  // — e.g. YouTube in a pinned background tab while the user browses elsewhere
  // or works in another app entirely.
  let audibleTabs: chrome.tabs.Tab[];
  try {
    audibleTabs = await chrome.tabs.query({ audible: true });
  } catch {
    return;
  }

  for (const tab of audibleTabs) {
    // Skip the active tab — already handled above
    if (!tab.id || tab.id === activeTabId || !tab.url) continue;

    const domain = extractDomain(tab.url);
    if (!domain) continue;

    const site = findLimitedSite(domain);
    if (!site) continue;

    ensureUsageToday(domain);
    usageCache[domain].usedSeconds += 1;

    const limitSeconds = site.limitMinutes * 60;
    const usedSeconds = usageCache[domain].usedSeconds;
    const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);

    chrome.tabs
      .sendMessage(tab.id, {
        type: "TIME_UPDATE",
        domain,
        usedSeconds,
        limitSeconds,
        remainingSeconds,
      })
      .catch(() => { });

    if (Date.now() - lastFlushAt > 10_000) void flushCache();

    if (remainingSeconds <= 0) {
      const d = domain;
      const tid = tab.id;
      void flushCache();
      void dispatchEmail("limit_exceeded", d);
      void chrome.tabs.update(tid, {
        url: chrome.runtime.getURL(
          "blocked.html?domain=" + encodeURIComponent(d) + "&type=limit",
        ),
      });
    }
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

  // Always begin tracking when a limited site becomes active.
  // Counting is not gated on window focus — handled in onTick.
  beginTracking(domain);

  // Push current state to the content script immediately
  chrome.tabs
    .sendMessage(tabId, {
      type: "TIME_UPDATE",
      domain,
      usedSeconds,
      limitSeconds,
      remainingSeconds: limitSeconds - usedSeconds,
    })
    .catch(() => { });
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

  // Register uninstall redirect URL with current accountability settings.
  void updateUninstallURL();

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
    windowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
    // Tracking is no longer paused on blur — active tabs and audible background
    // tabs count regardless of window focus. We still flush on blur to keep
    // storage current.
    if (!windowFocused) void flushCache();
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
    if (changes.accountabilitySettings) {
      void updateUninstallURL();
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
    port.onDisconnect.addListener(() => { });
  });

  chrome.alarms.create("flush", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "flush") void flushCache();
  });

  setInterval(() => { void onTick(); }, 1000);
});
