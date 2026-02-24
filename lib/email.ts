import type { AccountabilitySettings } from "./storage";

export type EmailEvent =
    | "limit_added"
    | "limit_removed"
    | "block_added"
    | "block_removed"
    | "limit_exceeded"
    | "limit_extended";

const eventNotifyKey: Record<
    EmailEvent,
    keyof Pick<
        AccountabilitySettings,
        | "notifyOnLimitAdded"
        | "notifyOnLimitRemoved"
        | "notifyOnBlockAdded"
        | "notifyOnBlockRemoved"
        | "notifyOnLimitExceeded"
        | "notifyOnLimitExtended"
    >
> = {
    limit_added: "notifyOnLimitAdded",
    limit_removed: "notifyOnLimitRemoved",
    block_added: "notifyOnBlockAdded",
    block_removed: "notifyOnBlockRemoved",
    limit_exceeded: "notifyOnLimitExceeded",
    limit_extended: "notifyOnLimitExtended",
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
                subject: `🎯 ${n} set a time limit for ${domain}`,
                message: `${n} set a daily time limit for ${domain}. Holding them accountable is now your job. Good luck. 💪`,
            };

        case "limit_removed":
            return {
                title: "Time Limit Removed",
                subject: `😬 ${n} removed the time limit for ${domain}`,
                message: `${n} removed their time limit for ${domain}. The internet wins again. 📺`,
            };

        case "block_added":
            return {
                title: "Site Blocked",
                subject: `🔒 ${n} blocked ${domain}`,
                message: `${n} blocked ${domain} completely. Apparently it had it coming. 🚫`,
            };

        case "block_removed":
            return {
                title: "Site Unblocked",
                subject: `🚨 ${n} unblocked ${domain}`,
                message: `${n} just unblocked ${domain}. Go make fun of them or something. 😂`,
            };

        case "limit_exceeded":
            return {
                title: "Daily Limit Hit",
                subject: `⏰ ${n} has surpassed their limit for ${domain}`,
                message: `${n} blew past their daily limit on ${domain}. Go make fun of them or something. 🙈`,
            };

        case "limit_extended":
            return {
                title: "Limit Extended",
                subject: `⏩ ${n} extended their time limit for ${domain}`,
                message: `${n} just gave themselves extra time on ${domain}. Accountability check — was that really necessary? 👀`,
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
