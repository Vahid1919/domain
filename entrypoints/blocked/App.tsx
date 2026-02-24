import { useEffect, useState } from "react";
import {
  getLimitedSites,
  getMotivationalSettings,
  saveMotivationalSettings,
} from "@/lib/storage";
import type { MotivationalSettings } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus, Check, Pencil, Clock } from "lucide-react";

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
  const [extendingMinutes, setExtendingMinutes] = useState<number | null>(null);

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

  const handleExtend = async (minutes: number) => {
    setExtendStatus("loading");
    setExtendingMinutes(minutes);
    const resp = await chrome.runtime.sendMessage({
      type: "EXTEND_LIMIT",
      domain,
      minutes,
    });
    if (resp?.ok) {
      setExtendStatus("done");
      setTimeout(() => history.back(), 600);
    } else {
      setExtendStatus("error");
      setExtendingMinutes(null);
      setTimeout(() => setExtendStatus("idle"), 2500);
    }
  };

  // Fall back to a built-in wallpaper when the user hasn't set one yet.
  // This is a display-only fallback — storage.imageUrl stays "" until the
  // user explicitly saves their own URL.
  const FALLBACK_IMAGE =
    "https://4kwallpapers.com/images/walls/thumbs_3t/16769.jpg";
  const resolvedImage = settings.imageUrl || FALLBACK_IMAGE;
  const hasBg = !imageError;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: hasBg ? undefined : "oklch(0.08 0 0)",
        backgroundImage: hasBg ? `url(${resolvedImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {resolvedImage && (
        <img
          src={resolvedImage}
          className="hidden"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
          alt=""
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" />

      {/* Pixel-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.25) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div
          className="rounded-xl border p-7 text-center"
          style={{
            background: "oklch(0.12 0 0 / 55%)",
            borderColor: isPermanent
              ? "oklch(0.72 0.15 200 / 30%)"
              : "oklch(0.78 0.14 200 / 30%)",
            boxShadow: isPermanent
              ? "0 0 0 1px oklch(0.72 0.15 200 / 10%), 0 24px 64px oklch(0 0 0 / 65%)"
              : "0 0 0 1px oklch(0.78 0.14 200 / 10%), 0 24px 64px oklch(0 0 0 / 65%), 0 0 50px oklch(0.78 0.14 200 / 12%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Icon — only for permanently blocked sites */}
          {isPermanent && (
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center mx-auto mb-5"
              style={{
                background: "oklch(0.72 0.15 200 / 15%)",
                border: "1px solid oklch(0.72 0.15 200 / 30%)",
              }}
            >
              <X
                style={{ color: "oklch(0.80 0.15 200)" }}
                className="w-5 h-5"
                strokeWidth={2.5}
              />
            </div>
          )}

          {/* Domain */}
          <p
            className="text-xs font-mono mb-2 tracking-widest uppercase"
            style={{ color: "oklch(0.45 0.005 60)" }}
          >
            {domain}
          </p>

          <h1
            className="font-pixel text-[13px] leading-relaxed mb-2"
            style={{
              color: isPermanent
                ? "oklch(0.78 0.15 200)"
                : "oklch(0.82 0.14 200)",
              textShadow: isPermanent
                ? "0 0 12px oklch(0.72 0.15 200 / 45%)"
                : "0 0 14px oklch(0.78 0.14 200 / 50%)",
            }}
          >
            {isPermanent ? "BLOCKED" : "TIME\u2019S UP"}
          </h1>

          <p
            className="text-xs leading-relaxed mb-6 font-mono"
            style={{ color: "oklch(0.46 0.005 60)" }}
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
              className="w-full text-left rounded-lg px-4 py-3 mb-5 group transition-colors cursor-pointer"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: "1px solid oklch(0.78 0.14 200 / 22%)",
              }}
              onClick={() => setEditing(true)}
            >
              <p
                className="text-sm leading-relaxed italic font-mono"
                style={{ color: "oklch(0.60 0.01 60)" }}
              >
                &ldquo;
                {settings.text || "Add a note to keep yourself on track\u2026"}
                &rdquo;
              </p>
              <p
                className="text-[11px] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                style={{ color: "oklch(0.40 0.005 60)" }}
              >
                <Pencil className="w-2.5 h-2.5" />
                Edit message
              </p>
            </button>
          ) : (
            <div
              className="rounded-lg p-4 mb-5 text-left space-y-3"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: "1px solid oklch(1 0 0 / 8%)",
              }}
            >
              <div className="space-y-1.5">
                <Label
                  className="text-[11px] font-medium"
                  style={{ color: "oklch(0.50 0.005 60)" }}
                >
                  Message
                </Label>
                <textarea
                  className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none transition font-mono"
                  style={{
                    background: "oklch(1 0 0 / 8%)",
                    border: "1px solid oklch(0.78 0.14 200 / 22%)",
                    color: "oklch(0.88 0.005 60)",
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
                  style={{ color: "oklch(0.50 0.005 60)" }}
                >
                  Background image URL
                </Label>
                <Input
                  className="h-8 text-xs font-mono"
                  style={{
                    background: "oklch(1 0 0 / 8%)",
                    borderColor: "oklch(0.78 0.14 200 / 22%)",
                    color: "oklch(0.88 0.005 60)",
                  }}
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder="https://\u2026"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  style={{ color: "oklch(0.40 0.005 60)" }}
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
            {!isPermanent && (
              <>
                {/* Extend buttons: +1m / +5m / +10m */}
                {extendStatus === "done" ? (
                  <div
                    className="w-full flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold"
                    style={{
                      background: "oklch(0.55 0.16 160 / 20%)",
                      border: "1px solid oklch(0.55 0.16 160 / 40%)",
                      color: "oklch(0.70 0.16 160)",
                    }}
                  >
                    <Check className="w-4 h-4" />+{extendingMinutes}m extended
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {([1, 5, 10] as const).map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleExtend(mins)}
                        disabled={extendStatus === "loading"}
                        className="flex-1 flex items-center justify-center gap-1 rounded-md py-2.5 text-sm font-semibold transition-all disabled:opacity-60"
                        style={{
                          background: "oklch(0.78 0.14 200 / 15%)",
                          border: "1px solid oklch(0.78 0.14 200 / 50%)",
                          color:
                            extendStatus === "loading" &&
                            extendingMinutes === mins
                              ? "oklch(0.84 0.14 200 / 60%)"
                              : "oklch(0.84 0.14 200)",
                        }}
                      >
                        {extendStatus === "loading" &&
                        extendingMinutes === mins ? (
                          "\u2026"
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            {mins}m
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Resets at midnight */}
                <div
                  className="flex items-center justify-center gap-1.5 text-xs font-mono"
                  style={{ color: "oklch(0.38 0.005 60)" }}
                >
                  <Clock className="w-3 h-3" />
                  resets in&nbsp;
                  <span style={{ color: "oklch(0.78 0.14 200)" }}>
                    {countdown}
                  </span>
                </div>
              </>
            )}

            {isPermanent && (
              <p
                className="text-[11px] font-mono"
                style={{ color: "oklch(0.38 0.005 60)" }}
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
