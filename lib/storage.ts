export interface LimitedSite {
    domain: string;
    limitMinutes: number;
}

export interface BlockedSite {
    domain: string;
}

export interface UsageEntry {
    date: string; // YYYY-MM-DD
    usedSeconds: number;
}

export interface MotivationalSettings {
    text: string;
    imageUrl: string;
}

export interface AccountabilitySettings {
    name: string;
    email: string;
    notifyOnLimitAdded: boolean;
    notifyOnLimitRemoved: boolean;
    notifyOnBlockAdded: boolean;
    notifyOnBlockRemoved: boolean;
    notifyOnLimitExceeded: boolean;
}

export function getTodayString(): string {
    return new Date().toISOString().split("T")[0];
}

// ── Limited sites ─────────────────────────────────────────────────────────────

export async function getLimitedSites(): Promise<LimitedSite[]> {
    const result = await chrome.storage.local.get("limitedSites");
    return (result["limitedSites"] as LimitedSite[] | undefined) ?? [];
}

export async function saveLimitedSites(sites: LimitedSite[]): Promise<void> {
    await chrome.storage.local.set({ limitedSites: sites });
}

export async function extendLimit(domain: string, extraMinutes: number): Promise<boolean> {
    const sites = await getLimitedSites();
    const idx = sites.findIndex(
        (s) => domain === s.domain || domain.endsWith("." + s.domain),
    );
    if (idx === -1) return false;
    sites[idx] = { ...sites[idx], limitMinutes: sites[idx].limitMinutes + extraMinutes };
    await saveLimitedSites(sites);
    return true;
}

// ── Blocked sites ─────────────────────────────────────────────────────────────

export async function getBlockedSites(): Promise<BlockedSite[]> {
    const result = await chrome.storage.local.get("blockedSites");
    return (result["blockedSites"] as BlockedSite[] | undefined) ?? [];
}

export async function saveBlockedSites(sites: BlockedSite[]): Promise<void> {
    await chrome.storage.local.set({ blockedSites: sites });
}

// ── Usage data ────────────────────────────────────────────────────────────────

export async function getUsageData(): Promise<Record<string, UsageEntry>> {
    const result = await chrome.storage.local.get("usageData");
    return (result["usageData"] as Record<string, UsageEntry> | undefined) ?? {};
}

export async function saveUsageData(
    data: Record<string, UsageEntry>,
): Promise<void> {
    await chrome.storage.local.set({ usageData: data });
}

// ── Motivational settings ─────────────────────────────────────────────────────

export async function getMotivationalSettings(): Promise<MotivationalSettings> {
    const result = await chrome.storage.local.get("motivationalSettings");
    const stored = result["motivationalSettings"] as MotivationalSettings | undefined;
    return stored ?? {
        text: "Your future self will thank you. Stay the course.",
        imageUrl: "",
    };
}

export async function saveMotivationalSettings(
    settings: MotivationalSettings,
): Promise<void> {
    await chrome.storage.local.set({ motivationalSettings: settings });
}

// ── Accountability settings ───────────────────────────────────────────────────

export async function getAccountabilitySettings(): Promise<AccountabilitySettings> {
    const result = await chrome.storage.local.get("accountabilitySettings");
    const stored = result["accountabilitySettings"] as AccountabilitySettings | undefined;
    return stored ?? {
        name: "",
        email: "",
        notifyOnLimitAdded: true,
        notifyOnLimitRemoved: true,
        notifyOnBlockAdded: true,
        notifyOnBlockRemoved: true,
        notifyOnLimitExceeded: true,
    };
}

export async function saveAccountabilitySettings(
    settings: AccountabilitySettings,
): Promise<void> {
    await chrome.storage.local.set({ accountabilitySettings: settings });
}
