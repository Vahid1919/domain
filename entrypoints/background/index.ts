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

// -- In-memory state
let usageCache: Record<string, UsageEntry> = {};
let limitedSitesCache: LimitedSite[] = [];
let blockedSitesCache: BlockedSite[] = [];

let activeTabId: number | null = null;
let currentDomain: string | null = null;
let windowFocused = true;

// -- Helpers
function extractDomain(url: string): string | null {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return null; }
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
}

async function dispatchEmail(event: EmailEvent, domain: string): Promise<void> {
    try {
        const settings = await getAccountabilitySettings();
        await sendEmail(settings, event, domain);
    } catch { /* silent */ }
}

// -- Tick (every second)
function onTick(): void {
    if (!currentDomain || !windowFocused || activeTabId === null) return;
    const site = findLimitedSite(currentDomain);
    if (!site) { currentDomain = null; return; }

    ensureUsageToday(currentDomain);
    usageCache[currentDomain].usedSeconds += 1;

    const limitSeconds = site.limitMinutes * 60;
    const usedSeconds = usageCache[currentDomain].usedSeconds;
    const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);

    chrome.tabs.sendMessage(activeTabId, {
        type: "TIME_UPDATE", domain: currentDomain,
        usedSeconds, limitSeconds, remainingSeconds,
    }).catch(() => { });

    if (remainingSeconds <= 0) {
        const domain = currentDomain;
        currentDomain = null;
        void flushCache();
        void dispatchEmail("limit_exceeded", domain);
        void chrome.tabs.update(activeTabId!, {
            url: chrome.runtime.getURL(
                "blocked.html?domain=" + encodeURIComponent(domain) + "&type=limit"
            ),
        });
    }
}

// -- Active tab management
async function updateActiveTab(tabId: number, url?: string): Promise<void> {
    activeTabId = tabId;
    if (!url) {
        try { const tab = await chrome.tabs.get(tabId); url = tab.url; }
        catch { currentDomain = null; return; }
    }
    if (!url || url.startsWith(chrome.runtime.getURL(""))) {
        currentDomain = null; return;
    }
    const domain = extractDomain(url);
    if (!domain) { currentDomain = null; return; }

    if (isBlockedSite(domain)) {
        currentDomain = null;
        void chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL(
                "blocked.html?domain=" + encodeURIComponent(domain) + "&type=blocked"
            ),
        });
        return;
    }

    const site = findLimitedSite(domain);
    if (!site) { currentDomain = null; return; }

    ensureUsageToday(domain);
    const usedSeconds = usageCache[domain].usedSeconds;
    const limitSeconds = site.limitMinutes * 60;

    if (usedSeconds >= limitSeconds) {
        currentDomain = null;
        void flushCache();
        void chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL(
                "blocked.html?domain=" + encodeURIComponent(domain) + "&type=limit"
            ),
        });
        return;
    }

    currentDomain = domain;
    chrome.tabs.sendMessage(tabId, {
        type: "TIME_UPDATE", domain, usedSeconds, limitSeconds,
        remainingSeconds: limitSeconds - usedSeconds,
    }).catch(() => { });
}

// -- Init
export default defineBackground(async () => {
    const [usage, limitedSites, blockedSites] = await Promise.all([
        getUsageData(), getLimitedSites(), getBlockedSites(),
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

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url) await updateActiveTab(tab.id, tab.url);

    chrome.tabs.onActivated.addListener(({ tabId }) => { void updateActiveTab(tabId); });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url) void updateActiveTab(tabId, changeInfo.url);
    });
    chrome.windows.onFocusChanged.addListener((windowId) => {
        windowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.limitedSites) {
            limitedSitesCache =
                (changes.limitedSites.newValue as LimitedSite[] | undefined) ?? [];
            if (currentDomain && !findLimitedSite(currentDomain)) currentDomain = null;
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
                    const usedSeconds = usageCache[currentDomain].usedSeconds;
                    const limitSeconds = site.limitMinutes * 60;
                    sendResponse({
                        type: "TIME_UPDATE", domain: currentDomain,
                        usedSeconds, limitSeconds,
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
            extendLimit(domain, minutes).then((ok) => {
                if (ok) {
                    // Refresh the in-memory cache so the extension picks it up immediately
                    getLimitedSites().then((sites) => { limitedSitesCache = sites; });
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
        if (msg.type === "TEST_EMAIL") {
            const settingsPromise = msg.settings
                ? Promise.resolve(msg.settings as AccountabilitySettings)
                : getAccountabilitySettings();
            settingsPromise
                .then((s) => sendEmail(s, "limit_added", "example.com"))
                .then((r) => sendResponse(r))
                .catch((e) => sendResponse({ ok: false, error: String(e) }));
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

    setInterval(onTick, 1000);
});
