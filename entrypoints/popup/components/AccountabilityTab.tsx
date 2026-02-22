import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Mail, FlaskConical } from "lucide-react";
import {
  getAccountabilitySettings,
  saveAccountabilitySettings,
} from "@/lib/storage";
import type { AccountabilitySettings } from "@/lib/storage";

// Only the boolean notify fields — keeps the key type tight so
// TypeScript never confuses it with the `email` string field.
type NotifyKey =
  | "notifyOnLimitAdded"
  | "notifyOnLimitRemoved"
  | "notifyOnBlockAdded"
  | "notifyOnBlockRemoved"
  | "notifyOnLimitExceeded";

const DEFAULT_SETTINGS: AccountabilitySettings = {
  name: "",
  email: "",
  notifyOnLimitAdded: true,
  notifyOnLimitRemoved: true,
  notifyOnBlockAdded: true,
  notifyOnBlockRemoved: true,
  notifyOnLimitExceeded: true,
};

const EVENT_TOGGLES: {
  key: NotifyKey;
  label: string;
  description: string;
}[] = [
  {
    key: "notifyOnLimitAdded",
    label: "Limit Added",
    description: "Email when a new time limit is created.",
  },
  {
    key: "notifyOnBlockAdded",
    label: "Site Blocked",
    description: "Email when a site is permanently blocked.",
  },
  {
    key: "notifyOnLimitExceeded",
    label: "Limit Exceeded",
    description: "Email when a daily time limit is hit.",
  },
  {
    key: "notifyOnLimitRemoved",
    label: "Limit Removed",
    description: "Email when a time limit is deleted.",
  },
  {
    key: "notifyOnBlockRemoved",
    label: "Site Unblocked",
    description: "Email when a blocked site is removed.",
  },
];

export default function AccountabilityTab() {
  const [settings, setSettings] =
    useState<AccountabilitySettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "sending" | "ok" | "error"
  >("idle");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    getAccountabilitySettings().then(setSettings);
  }, []);

  const update = (patch: Partial<AccountabilitySettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const handleSave = async () => {
    await saveAccountabilitySettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus("sending");
    setTestError("");
    const resp = await chrome.runtime.sendMessage({ type: "TEST_EMAIL" });
    if (resp?.ok) {
      setTestStatus("ok");
    } else {
      setTestStatus("error");
      setTestError(resp?.error ?? "Unknown error");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
            Accountability Partner
          </h2>
        </CardTitle>
        <CardDescription>
          Send emails via EmailJS when you change habits — honest, not harsh.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Your name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acct-name">Your name</Label>
          <Input
            id="acct-name"
            type="text"
            placeholder="Your name"
            value={settings.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            Used to personalise accountability emails.
          </p>
        </div>

        {/* Recipient email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acct-email">Send notifications to</Label>
          <Input
            id="acct-email"
            type="email"
            placeholder="friend@example.com"
            value={settings.email}
            onChange={(e) => update({ email: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            EmailJS credentials are configured at build time and kept out of
            storage.
          </p>
        </div>

        <Separator />

        {/* Event toggles */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Notify Me When…
          </h3>
          <ul className="flex flex-col gap-2">
            {EVENT_TOGGLES.map(({ key, label, description }) => {
              const enabled = settings[key];
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {enabled ? (
                      <Bell className="w-4 h-4 shrink-0 text-foreground" />
                    ) : (
                      <BellOff className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-none">
                        {label}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {description}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(v) =>
                      update({ [key]: v } as Partial<AccountabilitySettings>)
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={handleSave}>
            <Mail className="w-4 h-4 mr-1" />
            {saved ? "Saved!" : "Save Settings"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === "sending"}
          >
            <FlaskConical className="w-4 h-4 mr-1" />
            {testStatus === "sending"
              ? "Sending…"
              : testStatus === "ok"
                ? "Sent!"
                : "Test Email"}
          </Button>
        </div>
        {testStatus === "error" && (
          <p className="text-xs text-destructive">{testError}</p>
        )}
      </CardContent>
    </Card>
  );
}
