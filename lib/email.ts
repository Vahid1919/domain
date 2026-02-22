import type { AccountabilitySettings } from "./storage";

export type EmailEvent =
    | "limit_added"
    | "limit_removed"
    | "block_added"
    | "block_removed"
    | "limit_exceeded";

const eventNotifyKey: Record<
    EmailEvent,
    keyof Pick<
        AccountabilitySettings,
        | "notifyOnLimitAdded"
        | "notifyOnLimitRemoved"
        | "notifyOnBlockAdded"
        | "notifyOnBlockRemoved"
        | "notifyOnLimitExceeded"
    >
> = {
    limit_added: "notifyOnLimitAdded",
    limit_removed: "notifyOnLimitRemoved",
    block_added: "notifyOnBlockAdded",
    block_removed: "notifyOnBlockRemoved",
    limit_exceeded: "notifyOnLimitExceeded",
};

function getEmailContent(
    event: EmailEvent,
    domain: string,
    name: string,
): { title: string; subject: string; message: string } {
    const n = name.trim() || "your Buddy";
    switch (event) {
        case "limit_added":
            return {
                title: "Time Limit Set",
                subject: `🎯 ${n} set a time limit for ${domain} — nice work!`,
                message: `Great news!\n\n${n} just set a daily time limit for ${domain}. This is a genuinely powerful move — taking control of your attention is one of the most impactful things you can do for your goals.\n\n${n}'s future self is already proud. Keep building those habits. 💪`,
            };

        case "limit_removed":
            return {
                title: "Time Limit Removed",
                subject: `😬 ${n} removed the time limit for ${domain}`,
                message: `Heads up — ${n} quietly removed the time limit for ${domain}.\n\nNo judgment here... but there was almost certainly a reason it was set in the first place. Hopefully this is a conscious, deliberate choice and not just a fleeting moment of weakness. ${n}'s goals are patient, but they are watching. Just saying. 👀`,
            };

        case "block_added":
            return {
                title: "Site Blocked",
                subject: `🔒 ${n} blocked ${domain} for good — respect.`,
                message: `Excellent discipline!\n\n${n} has completely blocked ${domain}. That's not a small thing — it takes real self-awareness to recognize a distraction and actually do something about it.\n\nThe version of ${n} that made this call is the version worth listening to. Stay the course. 🚀`,
            };

        case "block_removed":
            return {
                title: "Site Unblocked",
                subject: `🚨 ${n} just unblocked ${domain}`,
                message: `Well... ${n} just unblocked ${domain}.\n\nWe're not here to judge — truly. But the fact that it was blocked in the first place is worth remembering. There was a reason. Hopefully this is an intentional, considered decision and not temptation quietly winning out.\n\nNo pressure. We believe in ${n}. Mostly. 😬`,
            };

        case "limit_exceeded":
            return {
                title: "Daily Limit Hit",
                subject: `⏰ ${n} hit the daily limit for ${domain}`,
                message: `Time's up — ${n} hit the daily limit on ${domain} for today.\n\nThe site is now blocked until midnight. We're not going to say "we told you so"... but the limit was set for a reason.\n\nHopefully those minutes were worth it. ${n}'s future self might have thoughts. See you at midnight! 🙈`,
            };
    }
}

// Credentials baked in at build time from .env — never stored in chrome.storage or shown in UI.
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as
    | string
    | undefined;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as
    | string
    | undefined;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as
    | string
    | undefined;

export function emailjsConfigured(): boolean {
    return !!EMAILJS_SERVICE_ID && !!EMAILJS_TEMPLATE_ID && !!EMAILJS_PUBLIC_KEY;
}

export async function sendEmail(
    settings: AccountabilitySettings,
    event: EmailEvent,
    domain: string,
): Promise<{ ok: boolean; error?: string }> {
    const notifyKey = eventNotifyKey[event];

    if (!settings.email || !settings[notifyKey]) {
        return { ok: false, error: "Recipient email not set or event disabled" };
    }

    if (!emailjsConfigured()) {
        return {
            ok: false,
            error: "EmailJS not configured (missing build-time env vars)",
        };
    }

    const { title, subject, message } = getEmailContent(event, domain, settings.name);

    // Prepend the subject line to the message body so it is always visible
    // in the email content even when the EmailJS template's Subject field is
    // static.  The `subject` template param is still passed separately so it
    // can be used as the actual email Subject header via {{subject}} in the
    // template's Subject field.
    const fullMessage = `${subject}\n\n${message}`;

    try {
        const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                service_id: EMAILJS_SERVICE_ID,
                template_id: EMAILJS_TEMPLATE_ID,
                user_id: EMAILJS_PUBLIC_KEY,
                template_params: {
                    to_email: settings.email,
                    name: settings.name,
                    title,
                    subject,
                    message: fullMessage,
                },
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            return { ok: false, error: `EmailJS error ${res.status}: ${text}` };
        }

        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}
