/**
 * Pure helper functions extracted from the background service worker.
 * These are the testable units — domain extraction, cache lookups, tick logic.
 * The full background uses these internally; we test them in isolation here.
 */

import type { LimitedSite, BlockedSite, UsageEntry } from "../lib/storage";

export function extractDomain(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

export function findLimitedSite(
    cache: LimitedSite[],
    domain: string,
): LimitedSite | undefined {
    return cache.find(
        (s) => domain === s.domain || domain.endsWith("." + s.domain),
    );
}

export function isBlockedSite(cache: BlockedSite[], domain: string): boolean {
    return cache.some(
        (s) => domain === s.domain || domain.endsWith("." + s.domain),
    );
}

export function getTodayString(): string {
    return new Date().toISOString().split("T")[0];
}

export function ensureUsageToday(
    usageCache: Record<string, UsageEntry>,
    domain: string,
): void {
    const today = getTodayString();
    if (!usageCache[domain] || usageCache[domain].date !== today) {
        usageCache[domain] = { date: today, usedSeconds: 0 };
    }
}

export interface TickState {
    usageCache: Record<string, UsageEntry>;
    limitedSitesCache: LimitedSite[];
    currentDomain: string | null;
    windowFocused: boolean;
    activeTabId: number | null;
}

export interface TickResult {
    usedSeconds: number;
    remainingSeconds: number;
    limitExceeded: boolean;
    currentDomain: string | null;
}

/**
 * Pure version of the background's onTick logic.
 * Returns the new state rather than calling chrome.tabs APIs.
 */
export function tick(state: TickState): TickResult {
    const { currentDomain, windowFocused, activeTabId } = state;

    if (!currentDomain || !windowFocused || activeTabId === null) {
        return {
            usedSeconds: 0,
            remainingSeconds: 0,
            limitExceeded: false,
            currentDomain,
        };
    }

    const site = findLimitedSite(state.limitedSitesCache, currentDomain);
    if (!site) {
        return {
            usedSeconds: 0,
            remainingSeconds: 0,
            limitExceeded: false,
            currentDomain: null,
        };
    }

    ensureUsageToday(state.usageCache, currentDomain);
    state.usageCache[currentDomain].usedSeconds += 1;

    const limitSeconds = site.limitMinutes * 60;
    const usedSeconds = state.usageCache[currentDomain].usedSeconds;
    const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);
    const limitExceeded = remainingSeconds <= 0;

    return {
        usedSeconds,
        remainingSeconds,
        limitExceeded,
        currentDomain: limitExceeded ? null : currentDomain,
    };
}

export type RedirectType = "blocked" | "limit" | "none";

export interface TabDecision {
    redirect: RedirectType;
    domain: string | null;
}

/**
 * Pure version of the background's updateActiveTab routing logic.
 * Decides what action to take for a given URL without calling chrome APIs.
 */
export function decideTabAction(
    url: string,
    limitedSitesCache: LimitedSite[],
    blockedSitesCache: BlockedSite[],
    usageCache: Record<string, UsageEntry>,
    extensionOrigin: string,
): TabDecision {
    if (!url || url.startsWith(extensionOrigin)) {
        return { redirect: "none", domain: null };
    }

    const domain = extractDomain(url);
    if (!domain) return { redirect: "none", domain: null };

    if (isBlockedSite(blockedSitesCache, domain)) {
        return { redirect: "blocked", domain };
    }

    const site = findLimitedSite(limitedSitesCache, domain);
    if (!site) return { redirect: "none", domain };

    ensureUsageToday(usageCache, domain);
    const used = usageCache[domain].usedSeconds;
    const limit = site.limitMinutes * 60;

    if (used >= limit) {
        return { redirect: "limit", domain };
    }

    return { redirect: "none", domain };
}
