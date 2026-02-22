import { useEffect, useRef, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { X, Clock, ChevronDown, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SiteFavicon } from "./SiteFavicon";
import { cn } from "@/lib/utils";
import {
  getLimitedSites,
  saveLimitedSites,
  getMotivationalSettings,
  saveMotivationalSettings,
} from "@/lib/storage";
import type { LimitedSite, MotivationalSettings } from "@/lib/storage";

interface SiteDisplay extends LimitedSite {
  usedSeconds: number;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SetLimitsTab() {
  const [sites, setSites] = useState<SiteDisplay[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("");
  const [motivational, setMotivational] = useState<MotivationalSettings>({
    text: "",
    imageUrl: "",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [editText, setEditText] = useState("");
  const [editImage, setEditImage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load from storage on mount ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [storedSites, storedMotivational] = await Promise.all([
        getLimitedSites(),
        getMotivationalSettings(),
      ]);
      const usageMap = await fetchUsage();
      setSites(
        storedSites.map((s) => ({
          ...s,
          usedSeconds: usageMap[s.domain] ?? 0,
        })),
      );
      setMotivational(storedMotivational);
      setEditText(storedMotivational.text);
      setEditImage(storedMotivational.imageUrl);
    }
    load();

    // Poll usage data every 3 seconds
    pollRef.current = setInterval(async () => {
      const usageMap = await fetchUsage();
      setSites((prev) =>
        prev.map((s) => ({
          ...s,
          usedSeconds: usageMap[s.domain] ?? s.usedSeconds,
        })),
      );
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function fetchUsage(): Promise<Record<string, number>> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_USAGE" }, (response) => {
        if (chrome.runtime.lastError || !response) resolve({});
        else resolve(response as Record<string, number>);
      });
    });
  }

  // ── Add / remove ───────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput || !minutesInput) return;
    const domain = domainInput.trim().replace(/^www\./, "");
    const limitMinutes = parseInt(minutesInput, 10);
    if (isNaN(limitMinutes) || limitMinutes <= 0) return;
    if (sites.find((s) => s.domain === domain)) return;

    const next: SiteDisplay[] = [
      ...sites,
      { domain, limitMinutes, usedSeconds: 0 },
    ];
    setSites(next);
    await saveLimitedSites(
      next.map(({ domain, limitMinutes }) => ({ domain, limitMinutes })),
    );
    chrome.runtime.sendMessage({
      type: "EMAIL_EVENT",
      event: "limit_added",
      domain,
    });
    setDomainInput("");
    setMinutesInput("");
  };

  const handleRemove = async (domain: string) => {
    const next = sites.filter((s) => s.domain !== domain);
    setSites(next);
    await saveLimitedSites(
      next.map(({ domain, limitMinutes }) => ({ domain, limitMinutes })),
    );
    chrome.runtime.sendMessage({
      type: "EMAIL_EVENT",
      event: "limit_removed",
      domain,
    });
  };

  // ── Save motivational settings ─────────────────────────────────────────
  const handleSaveSettings = async () => {
    const updated: MotivationalSettings = {
      text: editText.trim(),
      imageUrl: editImage.trim(),
    };
    await saveMotivationalSettings(updated);
    setMotivational(updated);
    setShowSettings(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold text-left self-start">
            Set Time Limits
          </h2>
        </CardTitle>
        <CardDescription>
          Define maximum time allowed per website per day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* ── Add form ─────────────────────────────────────────────────── */}
        <form className="flex w-full items-end gap-3" onSubmit={handleAdd}>
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="limit-website">Website Domain</Label>
            <Input
              id="limit-website"
              type="text"
              placeholder="e.g., youtube.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="text-base"
            />
          </span>
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="limit-minutes">Limit (minutes)</Label>
            <Input
              id="limit-minutes"
              type="number"
              min={1}
              placeholder="e.g., 30"
              value={minutesInput}
              onChange={(e) => setMinutesInput(e.target.value)}
              className="text-base"
            />
          </span>
          <Button type="submit">Add</Button>
        </form>

        <Separator />

        {/* ── Active limits ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Active Limits
          </h2>

          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
              <Clock className="w-8 h-8 text-primary opacity-50" />
              <p className="text-base">No limits set yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {sites.map((site) => {
                  const limitSeconds = site.limitMinutes * 60;
                  const pct = Math.min(
                    100,
                    (site.usedSeconds / limitSeconds) * 100,
                  );
                  const remainingMinutes = Math.max(
                    0,
                    Math.ceil((limitSeconds - site.usedSeconds) / 60),
                  );
                  const isNearLimit = pct >= 80;
                  const isExceeded = pct >= 100;

                  return (
                    <motion.li
                      key={site.domain}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        x: -16,
                        transition: { duration: 0.15 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Card className="p-4 gap-3 flex flex-col shadow-none border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <SiteFavicon domain={site.domain} size={16} />
                            <span className="font-semibold text-base truncate">
                              {site.domain}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(site.domain)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <Progress
                          value={pct}
                          className={cn(
                            "h-2.5 rounded-full",
                            isExceeded
                              ? "*:data-[slot=progress-indicator]:bg-destructive"
                              : isNearLimit
                                ? "*:data-[slot=progress-indicator]:bg-orange-500"
                                : "*:data-[slot=progress-indicator]:bg-primary",
                          )}
                        />

                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary" />
                            {formatTime(Math.floor(site.usedSeconds / 60))} used
                          </span>
                          <span
                            className={
                              isExceeded
                                ? "text-destructive font-medium"
                                : isNearLimit
                                  ? "text-orange-500 font-medium"
                                  : ""
                            }
                          >
                            {isExceeded
                              ? "Limit reached"
                              : `${formatTime(remainingMinutes)} left`}
                          </span>
                          <span>{formatTime(site.limitMinutes)} limit</span>
                        </div>
                      </Card>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <Separator />

        {/* ── Limit screen settings ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left group"
            onClick={() => setShowSettings((v) => !v)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              Block &amp; Limit Screen
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                showSettings
                  ? "rotate-180 text-primary"
                  : "text-muted-foreground",
              )}
            />
          </button>

          {showSettings && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-sm text-muted-foreground">
                Background &amp; message shown on both blocked and limit-reached
                pages.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mot-text" className="text-sm">
                  Motivational message
                </Label>
                <textarea
                  id="mot-text"
                  rows={2}
                  className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="e.g. Your goals matter more than this."
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mot-image" className="text-sm">
                  Background image URL
                </Label>
                <Input
                  id="mot-image"
                  type="url"
                  placeholder="https://images.unsplash.com/…"
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditText(motivational.text);
                    setEditImage(motivational.imageUrl);
                    setShowSettings(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveSettings}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
