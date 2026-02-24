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
import { Bell, BellOff, Mail } from "lucide-react";
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
  | "notifyOnLimitExceeded"
  | "notifyOnLimitExtended";

const DEFAULT_SETTINGS: AccountabilitySettings = {
  name: "",
  email: "",
  notifyOnLimitAdded: true,
  notifyOnLimitRemoved: true,
  notifyOnBlockAdded: true,
  notifyOnBlockRemoved: true,
  notifyOnLimitExceeded: true,
  notifyOnLimitExtended: true,
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
    key: "notifyOnLimitExtended",
    label: "Limit Extended",
    description: "Email when you give yourself extra time.",
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

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-5">
        <CardTitle>
          <h2 className="text-base font-semibold text-left self-start">
            Accountability
          </h2>
        </CardTitle>
        <CardDescription>
          Get notified when you change your habits. Keep yourself honest.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5 pb-4">
        {/* Recipient email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acct-email">Send notifications to</Label>
          <Input
            id="acct-email"
            type="email"
            placeholder="friend@example.com"
            aria-describedby="acct-email-hint"
            value={settings.email}
            onChange={(e) => update({ email: e.target.value })}
          />
          <p id="acct-email-hint" className="text-xs text-muted-foreground">
            Notifications go to this address.
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
                      <Bell className="w-4 h-4 shrink-0 text-primary" />
                    ) : (
                      <BellOff className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-base font-medium leading-none">
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {description}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={settings[key]}
                    aria-label={label}
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
        </div>
      </CardContent>
    </Card>
  );
}
