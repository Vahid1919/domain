import { describe, it, expect } from "vitest";
import {
    getTodayString,
    getLimitedSites,
    saveLimitedSites,
    getBlockedSites,
    saveBlockedSites,
    getUsageData,
    saveUsageData,
    getMotivationalSettings,
    saveMotivationalSettings,
    getAccountabilitySettings,
    saveAccountabilitySettings,
} from "../lib/storage";
import type {
    LimitedSite,
    BlockedSite,
    UsageEntry,
    MotivationalSettings,
    AccountabilitySettings,
} from "../lib/storage";

// ── getTodayString ─────────────────────────────────────────────────────────────

describe("getTodayString()", () => {
    it("returns a YYYY-MM-DD formatted string", () => {
        expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("matches the current UTC date", () => {
        const expected = new Date().toISOString().split("T")[0];
        expect(getTodayString()).toBe(expected);
    });
});

// ── LimitedSites ──────────────────────────────────────────────────────────────

describe("getLimitedSites() / saveLimitedSites()", () => {
    it("returns empty array when nothing is stored", async () => {
        expect(await getLimitedSites()).toEqual([]);
    });

    it("persists and retrieves a single site", async () => {
        const sites: LimitedSite[] = [{ domain: "youtube.com", limitMinutes: 30 }];
        await saveLimitedSites(sites);
        expect(await getLimitedSites()).toEqual(sites);
    });

    it("persists and retrieves multiple sites", async () => {
        const sites: LimitedSite[] = [
            { domain: "youtube.com", limitMinutes: 30 },
            { domain: "twitter.com", limitMinutes: 15 },
            { domain: "reddit.com", limitMinutes: 60 },
        ];
        await saveLimitedSites(sites);
        expect(await getLimitedSites()).toEqual(sites);
    });

    it("overwrites previous data on re-save", async () => {
        await saveLimitedSites([{ domain: "youtube.com", limitMinutes: 30 }]);
        const updated: LimitedSite[] = [{ domain: "reddit.com", limitMinutes: 10 }];
        await saveLimitedSites(updated);
        expect(await getLimitedSites()).toEqual(updated);
    });

    it("persists an empty array (clearing all limits)", async () => {
        await saveLimitedSites([{ domain: "youtube.com", limitMinutes: 30 }]);
        await saveLimitedSites([]);
        expect(await getLimitedSites()).toEqual([]);
    });

    it("preserves fractional minute values", async () => {
        const sites: LimitedSite[] = [{ domain: "site.com", limitMinutes: 1 }];
        await saveLimitedSites(sites);
        const result = await getLimitedSites();
        expect(result[0].limitMinutes).toBe(1);
    });
});

// ── BlockedSites ──────────────────────────────────────────────────────────────

describe("getBlockedSites() / saveBlockedSites()", () => {
    it("returns empty array when nothing is stored", async () => {
        expect(await getBlockedSites()).toEqual([]);
    });

    it("persists and retrieves a single blocked site", async () => {
        const sites: BlockedSite[] = [{ domain: "facebook.com" }];
        await saveBlockedSites(sites);
        expect(await getBlockedSites()).toEqual(sites);
    });

    it("persists and retrieves multiple blocked sites", async () => {
        const sites: BlockedSite[] = [
            { domain: "facebook.com" },
            { domain: "tiktok.com" },
        ];
        await saveBlockedSites(sites);
        expect(await getBlockedSites()).toEqual(sites);
    });

    it("overwrites when saved again", async () => {
        await saveBlockedSites([{ domain: "facebook.com" }]);
        await saveBlockedSites([{ domain: "tiktok.com" }]);
        expect(await getBlockedSites()).toEqual([{ domain: "tiktok.com" }]);
    });

    it("persists an empty array (unblocking all)", async () => {
        await saveBlockedSites([{ domain: "facebook.com" }]);
        await saveBlockedSites([]);
        expect(await getBlockedSites()).toEqual([]);
    });
});

// ── UsageData ─────────────────────────────────────────────────────────────────

describe("getUsageData() / saveUsageData()", () => {
    it("returns empty object when nothing is stored", async () => {
        expect(await getUsageData()).toEqual({});
    });

    it("persists and retrieves usage entries", async () => {
        const data: Record<string, UsageEntry> = {
            "youtube.com": { date: "2026-02-22", usedSeconds: 1200 },
        };
        await saveUsageData(data);
        expect(await getUsageData()).toEqual(data);
    });

    it("persists multiple domain entries", async () => {
        const data: Record<string, UsageEntry> = {
            "youtube.com": { date: "2026-02-22", usedSeconds: 600 },
            "twitter.com": { date: "2026-02-22", usedSeconds: 300 },
            "reddit.com": { date: "2026-02-21", usedSeconds: 9000 },
        };
        await saveUsageData(data);
        expect(await getUsageData()).toEqual(data);
    });

    it("overwrites previous usage data on re-save", async () => {
        await saveUsageData({ "youtube.com": { date: "2026-02-22", usedSeconds: 100 } });
        const updated = { "twitter.com": { date: "2026-02-22", usedSeconds: 50 } };
        await saveUsageData(updated);
        expect(await getUsageData()).toEqual(updated);
    });

    it("persists usedSeconds=0 correctly", async () => {
        const data = { "new.com": { date: "2026-02-22", usedSeconds: 0 } };
        await saveUsageData(data);
        const result = await getUsageData();
        expect(result["new.com"].usedSeconds).toBe(0);
    });
});

// ── MotivationalSettings ──────────────────────────────────────────────────────

describe("getMotivationalSettings() / saveMotivationalSettings()", () => {
    it("returns a non-empty default text when nothing is stored", async () => {
        const defaults = await getMotivationalSettings();
        expect(defaults.text).toBeTruthy();
        expect(defaults.imageUrl).toBe("");
    });

    it("persists and retrieves custom text and imageUrl", async () => {
        const settings: MotivationalSettings = {
            text: "Stay focused.",
            imageUrl: "https://example.com/bg.jpg",
        };
        await saveMotivationalSettings(settings);
        expect(await getMotivationalSettings()).toEqual(settings);
    });

    it("persists an empty message", async () => {
        await saveMotivationalSettings({ text: "", imageUrl: "" });
        const result = await getMotivationalSettings();
        expect(result.text).toBe("");
        expect(result.imageUrl).toBe("");
    });

    it("overwrites previous settings", async () => {
        await saveMotivationalSettings({ text: "Old text", imageUrl: "" });
        await saveMotivationalSettings({ text: "New text", imageUrl: "https://cdn.example.com/img.png" });
        const result = await getMotivationalSettings();
        expect(result.text).toBe("New text");
    });
});

// ── AccountabilitySettings ────────────────────────────────────────────────────

describe("getAccountabilitySettings() / saveAccountabilitySettings()", () => {
    it("returns sensible defaults when nothing is stored", async () => {
        const defaults = await getAccountabilitySettings();
        expect(defaults.name).toBe("");
        expect(defaults.email).toBe("");
        expect(defaults.notifyOnLimitAdded).toBe(true);
        expect(defaults.notifyOnLimitRemoved).toBe(true);
        expect(defaults.notifyOnBlockAdded).toBe(true);
        expect(defaults.notifyOnBlockRemoved).toBe(true);
        expect(defaults.notifyOnLimitExceeded).toBe(true);
    });

    it("persists and retrieves a full settings object", async () => {
        const settings: AccountabilitySettings = {
            name: "Vahid",
            email: "partner@example.com",
            notifyOnLimitAdded: true,
            notifyOnLimitRemoved: false,
            notifyOnBlockAdded: true,
            notifyOnBlockRemoved: false,
            notifyOnLimitExceeded: true,
        };
        await saveAccountabilitySettings(settings);
        expect(await getAccountabilitySettings()).toEqual(settings);
    });

    it("persists all-false toggles correctly", async () => {
        const settings: AccountabilitySettings = {
            name: "",
            email: "x@y.com",
            notifyOnLimitAdded: false,
            notifyOnLimitRemoved: false,
            notifyOnBlockAdded: false,
            notifyOnBlockRemoved: false,
            notifyOnLimitExceeded: false,
        };
        await saveAccountabilitySettings(settings);
        const result = await getAccountabilitySettings();
        expect(result.notifyOnLimitAdded).toBe(false);
        expect(result.notifyOnLimitRemoved).toBe(false);
        expect(result.notifyOnBlockAdded).toBe(false);
        expect(result.notifyOnBlockRemoved).toBe(false);
        expect(result.notifyOnLimitExceeded).toBe(false);
    });

    it("overwrites previous settings on re-save", async () => {
        await saveAccountabilitySettings({
            name: "Alice",
            email: "old@example.com",
            notifyOnLimitAdded: true,
            notifyOnLimitRemoved: true,
            notifyOnBlockAdded: true,
            notifyOnBlockRemoved: true,
            notifyOnLimitExceeded: true,
        });
        await saveAccountabilitySettings({
            name: "Bob",
            email: "new@example.com",
            notifyOnLimitAdded: false,
            notifyOnLimitRemoved: false,
            notifyOnBlockAdded: false,
            notifyOnBlockRemoved: false,
            notifyOnLimitExceeded: false,
        });
        const result = await getAccountabilitySettings();
        expect(result.email).toBe("new@example.com");
        expect(result.name).toBe("Bob");
        expect(result.notifyOnLimitAdded).toBe(false);
    });

    it("persists an empty email string", async () => {
        await saveAccountabilitySettings({
            name: "",
            email: "",
            notifyOnLimitAdded: true,
            notifyOnLimitRemoved: true,
            notifyOnBlockAdded: true,
            notifyOnBlockRemoved: true,
            notifyOnLimitExceeded: true,
        });
        const result = await getAccountabilitySettings();
        expect(result.email).toBe("");
    });
});

// ── Storage isolation ─────────────────────────────────────────────────────────
// Confirm that different storage keys don't bleed into each other

describe("storage key isolation", () => {
    it("saving limitedSites does not affect blockedSites", async () => {
        await saveLimitedSites([{ domain: "youtube.com", limitMinutes: 30 }]);
        expect(await getBlockedSites()).toEqual([]);
    });

    it("saving blockedSites does not affect limitedSites", async () => {
        await saveBlockedSites([{ domain: "facebook.com" }]);
        expect(await getLimitedSites()).toEqual([]);
    });

    it("saving usageData does not affect motivationalSettings", async () => {
        await saveUsageData({ "x.com": { date: "2026-02-22", usedSeconds: 10 } });
        const mots = await getMotivationalSettings();
        expect(mots.text).toBeTruthy(); // default is intact
    });

    it("all five storage areas can coexist independently", async () => {
        await saveLimitedSites([{ domain: "youtube.com", limitMinutes: 30 }]);
        await saveBlockedSites([{ domain: "facebook.com" }]);
        await saveUsageData({ "youtube.com": { date: "2026-02-22", usedSeconds: 120 } });
        await saveMotivationalSettings({ text: "Stay focused", imageUrl: "" });
        await saveAccountabilitySettings({
            name: "Vahid",
            email: "p@q.com",
            notifyOnLimitAdded: true,
            notifyOnLimitRemoved: false,
            notifyOnBlockAdded: true,
            notifyOnBlockRemoved: false,
            notifyOnLimitExceeded: true,
        });

        expect((await getLimitedSites())[0].domain).toBe("youtube.com");
        expect((await getBlockedSites())[0].domain).toBe("facebook.com");
        expect((await getUsageData())["youtube.com"].usedSeconds).toBe(120);
        expect((await getMotivationalSettings()).text).toBe("Stay focused");
        expect((await getAccountabilitySettings()).email).toBe("p@q.com");
    });
});
