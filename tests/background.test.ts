import { describe, it, expect, beforeEach } from "vitest";
import {
    extractDomain,
    findLimitedSite,
    isBlockedSite,
    ensureUsageToday,
    tick,
    decideTabAction,
    getTodayString,
} from "../lib/background-helpers";
import type { LimitedSite, BlockedSite, UsageEntry } from "../lib/storage";

// ── extractDomain ─────────────────────────────────────────────────────────────

describe("extractDomain()", () => {
    it("extracts a bare domain", () => {
        expect(extractDomain("https://youtube.com/watch?v=abc")).toBe("youtube.com");
    });

    it("strips www. prefix", () => {
        expect(extractDomain("https://www.youtube.com/watch")).toBe("youtube.com");
    });

    it("preserves non-www subdomains", () => {
        expect(extractDomain("https://mail.google.com")).toBe("mail.google.com");
    });

    it("works with http", () => {
        expect(extractDomain("http://reddit.com/r/programming")).toBe("reddit.com");
    });

    it("returns the hostname for chrome:// URLs (background filters these upstream)", () => {
        // chrome://settings parses as hostname "settings" — the background's
        // updateActiveTab skips extension pages before calling extractDomain,
        // so chrome:// URLs never reach this function in practice.
        expect(extractDomain("chrome://settings")).toBe("settings");
    });

    it("returns null for an empty string", () => {
        expect(extractDomain("")).toBeNull();
    });

    it("returns null for an invalid URL", () => {
        expect(extractDomain("not-a-url")).toBeNull();
    });

    it("handles URLs with ports", () => {
        expect(extractDomain("http://localhost:3000")).toBe("localhost");
    });

    it("handles URLs with paths and query strings", () => {
        expect(extractDomain("https://twitter.com/home?ref=nav")).toBe("twitter.com");
    });

    it("handles URLs with a hash", () => {
        expect(extractDomain("https://github.com/user/repo#readme")).toBe("github.com");
    });
});

// ── findLimitedSite ───────────────────────────────────────────────────────────

describe("findLimitedSite()", () => {
    const cache: LimitedSite[] = [
        { domain: "youtube.com", limitMinutes: 30 },
        { domain: "twitter.com", limitMinutes: 15 },
    ];

    it("finds an exact domain match", () => {
        expect(findLimitedSite(cache, "youtube.com")).toEqual({
            domain: "youtube.com",
            limitMinutes: 30,
        });
    });

    it("finds a subdomain match (e.g. m.youtube.com)", () => {
        expect(findLimitedSite(cache, "m.youtube.com")).toEqual({
            domain: "youtube.com",
            limitMinutes: 30,
        });
    });

    it("returns undefined for an unlisted domain", () => {
        expect(findLimitedSite(cache, "reddit.com")).toBeUndefined();
    });

    it("returns undefined for an empty cache", () => {
        expect(findLimitedSite([], "youtube.com")).toBeUndefined();
    });

    it("does not match partial domain (youtubeExtra.com ≠ youtube.com)", () => {
        expect(findLimitedSite(cache, "youtubeextra.com")).toBeUndefined();
    });

    it("matches multi-level subdomain (a.b.youtube.com)", () => {
        expect(findLimitedSite(cache, "a.b.youtube.com")).toBeDefined();
    });
});

// ── isBlockedSite ─────────────────────────────────────────────────────────────

describe("isBlockedSite()", () => {
    const cache: BlockedSite[] = [
        { domain: "facebook.com" },
        { domain: "tiktok.com" },
    ];

    it("returns true for an exact blocked domain", () => {
        expect(isBlockedSite(cache, "facebook.com")).toBe(true);
    });

    it("returns true for a subdomain of a blocked domain", () => {
        expect(isBlockedSite(cache, "m.facebook.com")).toBe(true);
    });

    it("returns false for an unblocked domain", () => {
        expect(isBlockedSite(cache, "github.com")).toBe(false);
    });

    it("returns false on an empty cache", () => {
        expect(isBlockedSite([], "facebook.com")).toBe(false);
    });

    it("does not false-positive on partial match (notfacebook.com)", () => {
        expect(isBlockedSite(cache, "notfacebook.com")).toBe(false);
    });

    it("is case-sensitive (FACEBOOK.COM does not match facebook.com)", () => {
        // Domains in the real world are lowercased by extractDomain, but the
        // helper itself is case-sensitive by design
        expect(isBlockedSite(cache, "FACEBOOK.COM")).toBe(false);
    });
});

// ── ensureUsageToday ──────────────────────────────────────────────────────────

describe("ensureUsageToday()", () => {
    it("creates a fresh entry when the domain is missing from the cache", () => {
        const cache: Record<string, UsageEntry> = {};
        ensureUsageToday(cache, "youtube.com");
        expect(cache["youtube.com"].usedSeconds).toBe(0);
        expect(cache["youtube.com"].date).toBe(getTodayString());
    });

    it("resets usedSeconds to 0 if the stored date is yesterday", () => {
        const cache: Record<string, UsageEntry> = {
            "youtube.com": { date: "2020-01-01", usedSeconds: 9999 },
        };
        ensureUsageToday(cache, "youtube.com");
        expect(cache["youtube.com"].usedSeconds).toBe(0);
        expect(cache["youtube.com"].date).toBe(getTodayString());
    });

    it("does NOT reset when the stored date is already today", () => {
        const today = getTodayString();
        const cache: Record<string, UsageEntry> = {
            "youtube.com": { date: today, usedSeconds: 300 },
        };
        ensureUsageToday(cache, "youtube.com");
        expect(cache["youtube.com"].usedSeconds).toBe(300);
    });

    it("does not touch other domains when ensuring one domain", () => {
        const today = getTodayString();
        const cache: Record<string, UsageEntry> = {
            "twitter.com": { date: today, usedSeconds: 120 },
        };
        ensureUsageToday(cache, "youtube.com");
        expect(cache["twitter.com"].usedSeconds).toBe(120);
    });
});

// ── tick() ────────────────────────────────────────────────────────────────────

describe("tick()", () => {
    const LIMITED: LimitedSite[] = [{ domain: "youtube.com", limitMinutes: 1 }]; // 60s limit
    const today = getTodayString();

    function makeState(
        overrides: Partial<{
            usedSeconds: number;
            currentDomain: string | null;
            activeTabId: number | null;
        }> = {},
    ) {
        const { usedSeconds = 0, currentDomain = "youtube.com", activeTabId = 1 } = overrides;
        return {
            usageCache: { "youtube.com": { date: today, usedSeconds } },
            limitedSitesCache: LIMITED,
            currentDomain,
            activeTabId,
        };
    }

    it("increments usedSeconds by 1 on each tick", () => {
        const state = makeState({ usedSeconds: 10 });
        const result = tick(state);
        expect(result.usedSeconds).toBe(11);
        expect(state.usageCache["youtube.com"].usedSeconds).toBe(11);
    });

    it("decrements remainingSeconds by 1 on each tick", () => {
        const state = makeState({ usedSeconds: 10 });
        const result = tick(state);
        expect(result.remainingSeconds).toBe(49); // 60 - 11
    });

    it("does nothing when activeTabId is null", () => {
        const state = makeState({ usedSeconds: 10, activeTabId: null });
        tick(state);
        expect(state.usageCache["youtube.com"].usedSeconds).toBe(10);
    });

    it("does nothing when currentDomain is null", () => {
        const state = makeState({ currentDomain: null });
        tick(state);
        expect(state.usageCache["youtube.com"].usedSeconds).toBe(0);
    });

    it("sets limitExceeded=true when the tick hits the limit exactly", () => {
        const state = makeState({ usedSeconds: 59 }); // 1 tick away from 60s limit
        const result = tick(state);
        expect(result.limitExceeded).toBe(true);
        expect(result.remainingSeconds).toBe(0);
    });

    it("sets limitExceeded=false while time remains", () => {
        const state = makeState({ usedSeconds: 30 });
        const result = tick(state);
        expect(result.limitExceeded).toBe(false);
    });

    it("sets currentDomain=null in result when limit is exceeded", () => {
        const state = makeState({ usedSeconds: 59 });
        const result = tick(state);
        expect(result.currentDomain).toBeNull();
    });

    it("keeps currentDomain set in result when limit is NOT exceeded", () => {
        const state = makeState({ usedSeconds: 30 });
        const result = tick(state);
        expect(result.currentDomain).toBe("youtube.com");
    });

    it("returns limitExceeded=false for domain not in limitedSitesCache", () => {
        const state = makeState({ currentDomain: "github.com" });
        const result = tick(state);
        expect(result.limitExceeded).toBe(false);
        expect(result.currentDomain).toBeNull();
    });

    it("caps remainingSeconds at 0 even if usedSeconds exceeds limit", () => {
        const state = makeState({ usedSeconds: 100 }); // already over 60s
        const result = tick(state);
        expect(result.remainingSeconds).toBe(0);
    });

    it("creates today's usage entry if missing (stale date reset)", () => {
        const state = {
            usageCache: { "youtube.com": { date: "2020-01-01", usedSeconds: 9999 } },
            limitedSitesCache: LIMITED,
            currentDomain: "youtube.com",
            activeTabId: 1,
        };
        const result = tick(state);
        expect(result.usedSeconds).toBe(1); // reset to 0 then incremented once
        expect(state.usageCache["youtube.com"].date).toBe(today);
    });
});

// ── decideTabAction() ─────────────────────────────────────────────────────────

describe("decideTabAction()", () => {
    const EXT_ORIGIN = "chrome-extension://test-id/";
    const LIMITED: LimitedSite[] = [{ domain: "youtube.com", limitMinutes: 1 }];
    const BLOCKED: BlockedSite[] = [{ domain: "facebook.com" }];
    const today = getTodayString();

    function emptyUsage(): Record<string, UsageEntry> {
        return {};
    }

    function usedUsage(domain: string, seconds: number): Record<string, UsageEntry> {
        return { [domain]: { date: today, usedSeconds: seconds } };
    }

    it("returns redirect=none and domain=null for extension pages", () => {
        const result = decideTabAction(
            "chrome-extension://test-id/popup.html",
            LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN,
        );
        expect(result.redirect).toBe("none");
        expect(result.domain).toBeNull();
    });

    it("returns redirect=none and domain=null for empty URL", () => {
        const result = decideTabAction("", LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN);
        expect(result.redirect).toBe("none");
        expect(result.domain).toBeNull();
    });

    it("returns redirect=none and domain=null for an unparseable URL", () => {
        const result = decideTabAction("not-a-url", LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN);
        expect(result.redirect).toBe("none");
        expect(result.domain).toBeNull();
    });

    it("returns redirect=blocked for a permanently blocked site", () => {
        const result = decideTabAction(
            "https://facebook.com/feed",
            LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN,
        );
        expect(result.redirect).toBe("blocked");
        expect(result.domain).toBe("facebook.com");
    });

    it("redirects a subdomain of a blocked site", () => {
        const result = decideTabAction(
            "https://m.facebook.com/",
            LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN,
        );
        expect(result.redirect).toBe("blocked");
        expect(result.domain).toBe("m.facebook.com");
    });

    it("returns redirect=limit when daily usage has been reached", () => {
        const result = decideTabAction(
            "https://youtube.com/watch?v=test",
            LIMITED, BLOCKED,
            usedUsage("youtube.com", 60), // exactly at limit
            EXT_ORIGIN,
        );
        expect(result.redirect).toBe("limit");
        expect(result.domain).toBe("youtube.com");
    });

    it("returns redirect=limit when daily usage exceeds the limit", () => {
        const result = decideTabAction(
            "https://youtube.com/",
            LIMITED, BLOCKED,
            usedUsage("youtube.com", 999),
            EXT_ORIGIN,
        );
        expect(result.redirect).toBe("limit");
    });

    it("returns redirect=none when under the time limit", () => {
        const result = decideTabAction(
            "https://youtube.com/",
            LIMITED, BLOCKED,
            usedUsage("youtube.com", 30), // 30s used, 60s limit
            EXT_ORIGIN,
        );
        expect(result.redirect).toBe("none");
        expect(result.domain).toBe("youtube.com");
    });

    it("returns redirect=none for a domain not in any list", () => {
        const result = decideTabAction(
            "https://github.com/",
            LIMITED, BLOCKED, emptyUsage(), EXT_ORIGIN,
        );
        expect(result.redirect).toBe("none");
        expect(result.domain).toBe("github.com");
    });

    it("blocked takes priority over limited (if a domain is in both lists)", () => {
        const alsoLimited: LimitedSite[] = [{ domain: "facebook.com", limitMinutes: 30 }];
        const result = decideTabAction(
            "https://facebook.com/",
            alsoLimited, BLOCKED, emptyUsage(), EXT_ORIGIN,
        );
        expect(result.redirect).toBe("blocked");
    });

    it("www. prefix is stripped before lookup", () => {
        const result = decideTabAction(
            "https://www.youtube.com/",
            LIMITED, BLOCKED,
            usedUsage("youtube.com", 60),
            EXT_ORIGIN,
        );
        expect(result.redirect).toBe("limit");
        expect(result.domain).toBe("youtube.com");
    });

    it("initialises a fresh usage entry for a new domain (usedSeconds=0, no redirect)", () => {
        const usage = emptyUsage();
        const result = decideTabAction(
            "https://youtube.com/",
            LIMITED, BLOCKED, usage, EXT_ORIGIN,
        );
        expect(result.redirect).toBe("none");
        expect(usage["youtube.com"].usedSeconds).toBe(0);
    });
});
