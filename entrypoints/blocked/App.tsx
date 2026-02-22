import { useEffect, useState } from "react";
import {
  getLimitedSites,
  getMotivationalSettings,
  saveMotivationalSettings,
} from "@/lib/storage";
import type { MotivationalSettings } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function useCountdownToMidnight() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.max(0, midnight.getTime() - now);
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLabel(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);

  return label;
}

export default function BlockedApp() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get("domain") ?? "this site";
  const blockType = (params.get("type") ?? "limit") as "limit" | "blocked";
  const isPermanent = blockType === "blocked";

  const [settings, setSettings] = useState<MotivationalSettings>({
    text: "",
    imageUrl: "",
  });
  const [limitMinutes, setLimitMinutes] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editImage, setEditImage] = useState("");
  const [imageError, setImageError] = useState(false);

  const countdown = useCountdownToMidnight();

  useEffect(() => {
    getMotivationalSettings().then((s) => {
      setSettings(s);
      setEditText(s.text);
      setEditImage(s.imageUrl);
    });

    getLimitedSites().then((sites) => {
      const site = sites.find(
        (s) => domain === s.domain || domain.endsWith("." + s.domain),
      );
      if (site) setLimitMinutes(site.limitMinutes);
    });
  }, [domain]);

  const handleSave = async () => {
    const updated: MotivationalSettings = {
      text: editText.trim(),
      imageUrl: editImage.trim(),
    };
    await saveMotivationalSettings(updated);
    setSettings(updated);
    setImageError(false);
    setEditing(false);
  };

  const hasBg = !!settings.imageUrl && !imageError;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950"
      style={
        hasBg
          ? {
              backgroundImage: `url(${settings.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Hidden img to detect load errors */}
      {settings.imageUrl && (
        <img
          src={settings.imageUrl}
          className="hidden"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
          alt=""
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-slate-900/85 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center">
          {/* Stop icon */}
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-6">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>

          {/* Domain + headline */}
          <h1 className="text-xl font-bold text-white mb-0.5">{domain}</h1>
          {isPermanent ? (
            <>
              <p className="text-amber-400 font-semibold text-sm mb-1">
                Site permanently blocked
              </p>
              <p className="text-slate-400 text-xs mb-7">
                This site is on your blocked list. Remove it from the extension
                to regain access.
              </p>
            </>
          ) : (
            <>
              <p className="text-red-400 font-semibold text-sm mb-1">
                Daily limit reached
              </p>
              {limitMinutes !== null && (
                <p className="text-slate-400 text-xs mb-7">
                  You&apos;ve used your full {formatMinutes(limitMinutes)}{" "}
                  allowance for today.
                </p>
              )}
            </>
          )}

          {/* Motivational message */}
          {!editing ? (
            <button
              className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl px-4 py-3.5 mb-6 group transition-colors cursor-pointer"
              onClick={() => setEditing(true)}
            >
              <p className="text-slate-200 text-sm leading-relaxed italic">
                &ldquo;
                {settings.text || "Click here to add a motivational message…"}
                &rdquo;
              </p>
              <p className="text-slate-500 text-xs mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                ✏️ Click to edit message &amp; background
              </p>
            </button>
          ) : (
            <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-6 text-left space-y-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-medium">
                  Motivational message
                </Label>
                <textarea
                  className="w-full bg-white/10 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="e.g. Your goals matter more than this."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-medium">
                  Background image URL
                </Label>
                <Input
                  className="bg-white/10 border-white/10 text-white text-sm h-8 placeholder-slate-500 focus-visible:ring-blue-500"
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder="https://images.unsplash.com/…"
                />
              </div>
              <div className="flex gap-2 justify-end pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 h-7 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Reset countdown — only for timed limits */}
          {!isPermanent && (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Resets in&nbsp;
              <span className="font-mono text-slate-400 font-medium">
                {countdown}
              </span>
            </div>
          )}
          {isPermanent && (
            <p className="text-slate-600 text-xs">
              ✊ Stay focused. You&apos;ve got this.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
