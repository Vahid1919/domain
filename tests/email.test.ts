import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail, emailjsConfigured } from "../lib/email";
import type { EmailEvent } from "../lib/email";
import type { AccountabilitySettings } from "../lib/storage";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_ENABLED: AccountabilitySettings = {
    email: "friend@example.com",
    name: "Vahid",
    notifyOnLimitAdded: true,
    notifyOnLimitRemoved: true,
    notifyOnBlockAdded: true,
    notifyOnBlockRemoved: true,
    notifyOnLimitExceeded: true,
};

const ALL_DISABLED: AccountabilitySettings = {
    email: "friend@example.com",
    name: "Vahid",
    notifyOnLimitAdded: false,
    notifyOnLimitRemoved: false,
    notifyOnBlockAdded: false,
    notifyOnBlockRemoved: false,
    notifyOnLimitExceeded: false,
};

const NO_EMAIL: AccountabilitySettings = {
    ...ALL_ENABLED,
    email: "",
};

const DOMAIN = "twitter.com";

// ── emailjsConfigured ─────────────────────────────────────────────────────────

describe("emailjsConfigured()", () => {
    it("returns true when all three env vars are present (set in vitest.config.ts)", () => {
        expect(emailjsConfigured()).toBe(true);
    });
});

// ── sendEmail — guard clauses ─────────────────────────────────────────────────

describe("sendEmail() — guard clauses", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    it("returns error when email is empty", async () => {
        const result = await sendEmail(NO_EMAIL, "limit_added", DOMAIN);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/recipient email not set/i);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("returns error when the specific event toggle is disabled", async () => {
        const result = await sendEmail(ALL_DISABLED, "limit_added", DOMAIN);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/event disabled/i);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("still returns error for a disabled toggle even if email is set", async () => {
        const s: AccountabilitySettings = { ...ALL_ENABLED, notifyOnLimitRemoved: false };
        const result = await sendEmail(s, "limit_removed", DOMAIN);
        expect(result.ok).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });
});

// ── sendEmail — fetch call shape ──────────────────────────────────────────────

describe("sendEmail() — fetch payload", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
    });

    const events: EmailEvent[] = [
        "limit_added",
        "limit_removed",
        "block_added",
        "block_removed",
        "limit_exceeded",
    ];

    for (const event of events) {
        it(`sends a POST request for event: ${event}`, async () => {
            const result = await sendEmail(ALL_ENABLED, event, DOMAIN);
            expect(result.ok).toBe(true);
            expect(fetch).toHaveBeenCalledOnce();

            const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toBe("https://api.emailjs.com/api/v1.0/email/send");
            expect(init.method).toBe("POST");
            expect(init.headers["Content-Type"]).toBe("application/json");
        });
    }

    it("passes service_id, template_id, user_id from build-time env vars", async () => {
        await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(body.service_id).toBe("service_test");
        expect(body.template_id).toBe("template_test");
        expect(body.user_id).toBe("pubkey_test");
    });

    it("passes to_email from settings.email", async () => {
        await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(body.template_params.to_email).toBe("friend@example.com");
    });

    it("includes a non-empty title, subject and message in template_params", async () => {
        await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(body.template_params.title).toBeTruthy();
        expect(body.template_params.subject).toBeTruthy();
        expect(body.template_params.message).toBeTruthy();
    });
});

// ── Email content — subject / message per event ───────────────────────────────

describe("sendEmail() — email content", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
    });

    async function getBody(event: EmailEvent, domain: string) {
        await sendEmail(ALL_ENABLED, event, domain);
        return JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
            .template_params as { title: string; subject: string; message: string };
    }

    it("limit_added — subject contains the domain and a positive tone emoji", async () => {
        const { title, subject, message } = await getBody("limit_added", "youtube.com");
        expect(subject).toContain("youtube.com");
        expect(subject).toMatch(/🎯/);
        expect(subject).toContain("Vahid");
        // subject is prepended to the message body
        expect(message).toContain("youtube.com");
        expect(message).toContain("Vahid");
        expect(message.startsWith(subject)).toBe(true);
        expect(title).toBe("Time Limit Set");
    });

    it("limit_removed — subject contains the domain and a cautionary tone", async () => {
        const { title, subject, message } = await getBody("limit_removed", "youtube.com");
        expect(subject).toContain("youtube.com");
        expect(subject).toMatch(/😬/);
        expect(subject).toContain("Vahid");
        expect(message).toContain("youtube.com");
        expect(message).toContain("Vahid");
        expect(message.startsWith(subject)).toBe(true);
        expect(title).toBe("Time Limit Removed");
    });

    it("block_added — subject contains the domain and a positive tone emoji", async () => {
        const { title, subject, message } = await getBody("block_added", "reddit.com");
        expect(subject).toContain("reddit.com");
        expect(subject).toMatch(/🔒/);
        expect(subject).toContain("Vahid");
        expect(message).toContain("reddit.com");
        expect(message).toContain("Vahid");
        expect(message.startsWith(subject)).toBe(true);
        expect(title).toBe("Site Blocked");
    });

    it("block_removed — subject contains the domain and a warning emoji", async () => {
        const { title, subject, message } = await getBody("block_removed", "reddit.com");
        expect(subject).toContain("reddit.com");
        expect(subject).toMatch(/🚨/);
        expect(subject).toContain("Vahid");
        expect(message).toContain("reddit.com");
        expect(message).toContain("Vahid");
        expect(message.startsWith(subject)).toBe(true);
        expect(title).toBe("Site Unblocked");
    });

    it("limit_exceeded — subject contains the domain and a clock emoji", async () => {
        const { title, subject, message } = await getBody("limit_exceeded", "twitter.com");
        expect(subject).toContain("twitter.com");
        expect(subject).toMatch(/⏰/);
        expect(subject).toContain("Vahid");
        expect(message).toContain("twitter.com");
        expect(message).toContain("Vahid");
        expect(message.startsWith(subject)).toBe(true);
        expect(title).toBe("Daily Limit Hit");
    });

    it("falls back to 'your Buddy' when name is empty", async () => {
        const noName: AccountabilitySettings = { ...ALL_ENABLED, name: "" };
        await sendEmail(noName, "limit_added", "github.com");
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        const { subject, message } = body.template_params as { subject: string; message: string };
        expect(subject).toContain("github.com");
        expect(subject).toContain("your Buddy");
        expect(message).toContain("your Buddy");
    });

    it("passes name in template_params", async () => {
        await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(body.template_params.name).toBe("Vahid");
    });

    it("each event produces a unique subject for the same domain", async () => {
        const events: EmailEvent[] = [
            "limit_added", "limit_removed", "block_added", "block_removed", "limit_exceeded",
        ];
        const subjects = new Set<string>();
        for (const event of events) {
            vi.clearAllMocks();
            const { subject } = await getBody(event, DOMAIN);
            subjects.add(subject);
        }
        expect(subjects.size).toBe(5);
    });

    it("domain is reflected correctly for a subdomain-style input", async () => {
        const { subject } = await getBody("limit_added", "mail.google.com");
        expect(subject).toContain("mail.google.com");
    });
});

// ── sendEmail — fetch error handling ─────────────────────────────────────────

describe("sendEmail() — fetch error handling", () => {
    it("returns { ok: false, error } when fetch returns a non-ok response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "Bad request" }),
        );
        const result = await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("422");
        expect(result.error).toContain("Bad request");
    });

    it("returns { ok: false, error } when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
        const result = await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("Network failure");
    });

    it("returns { ok: true } on a 200 response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
        const result = await sendEmail(ALL_ENABLED, "limit_added", DOMAIN);
        expect(result.ok).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("each notify toggle independently gates sending", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
        const toggleMap: Record<EmailEvent, keyof AccountabilitySettings> = {
            limit_added: "notifyOnLimitAdded",
            limit_removed: "notifyOnLimitRemoved",
            block_added: "notifyOnBlockAdded",
            block_removed: "notifyOnBlockRemoved",
            limit_exceeded: "notifyOnLimitExceeded",
        };
        for (const [event, key] of Object.entries(toggleMap) as [EmailEvent, keyof AccountabilitySettings][]) {
            vi.clearAllMocks();
            const s = { ...ALL_ENABLED, [key]: false };
            const result = await sendEmail(s, event, DOMAIN);
            expect(result.ok, `${event} should be blocked when ${key}=false`).toBe(false);
            expect(fetch, `fetch should not be called for disabled ${event}`).not.toHaveBeenCalled();
        }
    });
});
