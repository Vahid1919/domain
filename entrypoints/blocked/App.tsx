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
import { Clock, Plus, Pencil, X, Check } from "lucide-react";

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
  const [extendStatus, setExtendStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");

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

  const handleExtend = async () => {
    setExtendStatus("loading");
    const resp = await chrome.runtime.sendMessage({
      type: "EXTEND_LIMIT",
      domain,
      minutes: 5,
    });
    if (resp?.ok) {
      setExtendStatus("done");
      // Go back to the previous page
      setTimeout(() => history.back(), 600);
    } else {
      setExtendStatus("error");
      setTimeout(() => setExtendStatus("idle"), 2500);
    }
  };

  const hasBg = !!settings.imageUrl && !imageError;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: hasBg ? undefined : "oklch(0.10 0.015 260)",
        backgroundImage: hasBg ? `url(${settings.imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
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

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-90 mx-4">
        <div
          className="rounded-2xl border p-7 text-center"
          style={{
            background: "oklch(0.15 0.01 260 / 90%)",
            borderColor: "oklch(1 0 0 / 10%)",
            boxShadow: isPermanent
              ? "0 0 0 1px oklch(1 0 0 / 5%), 0 24px 64px oklch(0 0 0 / 60%)"
              : "0 0 0 1px oklch(1 0 0 / 5%), 0 24px 64px oklch(0 0 0 / 60%), 0 0 60px oklch(0.65 0.22 22 / 12%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Status indicator */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: isPermanent
                ? "oklch(0.65 0.14 50 / 15%)"
                : "oklch(0.65 0.22 22 / 15%)",
              border: isPermanent
                ? "1px solid oklch(0.65 0.14 50 / 30%)"
                : "1px solid oklch(0.65 0.22 22 / 30%)",
            }}
          >
            {isPermanent ? (
              <X
                style={{ color: "oklch(0.75 0.14 50)" }}
                className="w-5 h-5"
                strokeWidth={2.5}
              />
            ) : (
              <Clock
                style={{ color: "oklch(0.70 0.22 22)" }}
                className="w-5 h-5"
                strokeWidth={2.5}
              />
            )}
          </div>

          {/* Domain */}
          <p
            className="text-xs font-mono mb-1.5 tracking-widest uppercase"
            style={{ color: "oklch(0.55 0.01 260)" }}
          >
            {domain}
          </p>

          <h1
            className="text-lg font-semibold tracking-tight mb-1"
            style={{ color: "oklch(0.93 0.01 260)" }}
          >
            {isPermanent ? "Site blocked" : "Time's up"}
          </h1>

          <p
            className="text-xs leading-relaxed mb-6"
            style={{ color: "oklch(0.50 0.01 260)" }}
          >
            {isPermanent
              ? "This site is on your blocked list."
              : limitMinutes !== null
                ? `Your ${formatMinutes(limitMinutes)} daily budget for this site has been used.`
                : "Your daily budget for this site has been used."}
          </p>

          {/* Motivational message */}
          {!editing ? (
            <button
              className="w-full text-left rounded-xl px-4 py-3 mb-5 group transition-colors cursor-pointer"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: "1px solid oklch(1 0 0 / 7%)",
              }}
              onClick={() => setEditing(true)}
            >
              <p
                className="text-sm leading-relaxed italic"
                style={{ color: "oklch(0.70 0.01 260)" }}
              >
                &ldquo;
                {settings.text || "Add a note to keep yourself on track…"}
                &rdquo;
              </p>
              <p
                className="text-[11px] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                style={{ color: "oklch(0.45 0.01 260)" }}
              >
                <Pencil className="w-2.5 h-2.5" />
                Edit message
              </p>
            </button>
          ) : (
            <div
              className="rounded-xl p-4 mb-5 text-left space-y-3"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: "1px solid oklch(1 0 0 / 8%)",
              }}
            >
              <div className="space-y-1.5">
                <Label
                  className="text-[11px] font-medium"
                  style={{ color: "oklch(0.55 0.01 260)" }}
                >
                  Message
                </Label>
                <textarea
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none transition"
                  style={{
                    background: "oklch(1 0 0 / 8%)",
                    border: "1px solid oklch(1 0 0 / 10%)",
                    color: "oklch(0.90 0.01 260)",
                  }}
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="e.g. Your goals matter more than this."
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  className="text-[11px] font-medium"
                  style={{ color: "oklch(0.55 0.01 260)" }}
                >
                  Background image URL
                </Label>
                <Input
                  className="h-8 text-xs"
                  style={{
                    background: "oklch(1 0 0 / 8%)",
                    borderColor: "oklch(1 0 0 / 10%)",
                    color: "oklch(0.90 0.01 260)",
                  }}
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  style={{ color: "oklch(0.45 0.01 260)" }}
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

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {/* +5 min button — only for timed limits */}
            {!isPermanent && (
              <button
                onClick={handleExtend}
                disabled={extendStatus === "loading" || extendStatus === "done"}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-60"
                style={{
                  background:
                    extendStatus === "done"
                      ? "oklch(0.55 0.16 160 / 20%)"
                      : "oklch(0.72 0.16 210 / 15%)",
                  border:
                    extendStatus === "done"
                      ? "1px solid oklch(0.55 0.16 160 / 40%)"
                      : "1px solid oklch(0.72 0.16 210 / 35%)",
                  color:
                    extendStatus === "done"
                      ? "oklch(0.70 0.16 160)"
                      : "oklch(0.80 0.12 210)",
                }}
              >
                {extendStatus === "done" ? (
                  <>
                    <Check className="w-4 h-4" />
                    Limit extended
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {extendStatus === "loading"
                      ? "Extending…"
                      : "5 more minutes"}
                  </>
                )}
              </button>
            )}

            {/* Reset countdown */}
            {!isPermanent && (
              <div
                className="flex items-center justify-center gap-1.5 text-[11px] font-mono"
                style={{ color: "oklch(0.38 0.01 260)" }}
              >
                <Clock className="w-3 h-3" />
                Resets in&nbsp;
                <span style={{ color: "oklch(0.48 0.01 260)" }}>
                  {countdown}
                </span>
              </div>
            )}

            {isPermanent && (
              <p
                className="text-[11px]"
                style={{ color: "oklch(0.38 0.01 260)" }}
              >
                Remove it from the extension to regain access.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
