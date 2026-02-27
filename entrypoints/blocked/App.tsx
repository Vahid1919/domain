import { useEffect, useState } from "react";
import {
  getLimitedSites,
  getMotivationalSettings,
  saveMotivationalSettings,
} from "@/lib/storage";
import type { MotivationalSettings } from "@/lib/storage";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Check, Pencil, Clock, Sparkles, ShieldCheck } from "lucide-react";

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
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
  const [extendStatus, setExtendStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [extendingMinutes, setExtendingMinutes] = useState<number | null>(null);

  const countdown = useCountdownToMidnight();

  useEffect(() => {
    getMotivationalSettings().then((s) => {
      setSettings(s);
      setEditText(s.text);
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
      imageUrl: settings.imageUrl,
    };
    await saveMotivationalSettings(updated);
    setSettings(updated);
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

  /* ─── colour tokens ───────────────────────────────────────── */
  const accent = isPermanent
    ? { h: 260, c: 0.18 } // soft violet for blocked
    : { h: 200, c: 0.16 }; // sky‑teal for limit

  const accentBase = `oklch(0.78 ${accent.c} ${accent.h})`;
  const accentDim  = `oklch(0.78 ${accent.c} ${accent.h} / 22%)`;
  const accentGlow = `oklch(0.78 ${accent.c} ${accent.h} / 40%)`;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: isPermanent
          ? "radial-gradient(ellipse 120% 80% at 50% 0%, oklch(0.14 0.06 260) 0%, oklch(0.08 0.01 260) 70%)"
          : "radial-gradient(ellipse 120% 80% at 50% 0%, oklch(0.13 0.05 200) 0%, oklch(0.07 0.01 220) 70%)",
      }}
    >
      {/* Ambient glow behind card */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{
          width: 480,
          height: 320,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%)",
          background: `oklch(0.60 ${accent.c} ${accent.h} / 12%)`,
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg mx-6">
        <div
          className="rounded-2xl border px-10 py-12 text-center"
          style={{
            background: "oklch(0.11 0.01 240 / 70%)",
            borderColor: accentDim,
            boxShadow: `0 0 0 1px ${accentDim}, 0 32px 80px oklch(0 0 0 / 70%), 0 0 60px ${accentGlow}`,
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Icon badge */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{
              background: `oklch(0.78 ${accent.c} ${accent.h} / 12%)`,
              border: `1.5px solid ${accentDim}`,
              boxShadow: `0 0 24px ${accentGlow}`,
            }}
          >
            {isPermanent
              ? <ShieldCheck style={{ color: accentBase }} className="w-7 h-7" strokeWidth={1.8} />
              : <Sparkles   style={{ color: accentBase }} className="w-7 h-7" strokeWidth={1.8} />
            }
          </div>

          {/* Headline */}
          <h1
            className="text-5xl font-bold tracking-tight mb-3 leading-none"
            style={{
              color: accentBase,
              textShadow: `0 0 32px ${accentGlow}`,
            }}
          >
            {isPermanent ? "Blocked" : "Well done!"}
          </h1>

          {/* Sub-headline */}
          <p
            className="text-xl font-medium mb-2"
            style={{ color: "oklch(0.82 0.01 220)" }}
          >
            {isPermanent
              ? "This site is off-limits."
              : "You've used your time for today."}
          </p>

          {/* Domain pill */}
          <div className="flex items-center justify-center mb-8">
            <span
              className="inline-block rounded-full px-4 py-1 text-sm font-mono tracking-wide"
              style={{
                background: `oklch(0.78 ${accent.c} ${accent.h} / 10%)`,
                border: `1px solid ${accentDim}`,
                color: `oklch(0.65 ${accent.c} ${accent.h})`,
              }}
            >
              {domain}
            </span>
          </div>

          {/* Limit info */}
          {!isPermanent && limitMinutes !== null && (
            <p
              className="text-base mb-8 leading-relaxed"
              style={{ color: "oklch(0.55 0.01 220)" }}
            >
              Your daily allowance of&nbsp;
              <span style={{ color: "oklch(0.75 0.01 220)", fontWeight: 600 }}>
                {formatMinutes(limitMinutes)}
              </span>
              &nbsp;has been used. Take a break — you've earned it.
            </p>
          )}

          {/* ─── Motivational message ─────────────────────────── */}
          {!editing ? (
            <button
              className="w-full text-left rounded-xl px-6 py-5 mb-8 group transition-all cursor-pointer"
              style={{
                background: `oklch(0.78 ${accent.c} ${accent.h} / 6%)`,
                border: `1.5px solid ${accentDim}`,
              }}
              onClick={() => setEditing(true)}
            >
              <p
                className="text-lg leading-relaxed italic"
                style={{ color: "oklch(0.72 0.01 220)" }}
              >
                &ldquo;
                {settings.text || "Add a personal note to keep yourself on track\u2026"}
                &rdquo;
              </p>
              <p
                className="text-sm mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
                style={{ color: "oklch(0.45 0.005 220)" }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit your message
              </p>
            </button>
          ) : (
            <div
              className="rounded-xl p-6 mb-8 text-left space-y-4"
              style={{
                background: "oklch(1 0 0 / 4%)",
                border: "1.5px solid oklch(1 0 0 / 10%)",
              }}
            >
              <div className="space-y-2">
                <Label
                  className="text-sm font-medium"
                  style={{ color: "oklch(0.55 0.005 220)" }}
                >
                  Your motivational message
                </Label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 text-base resize-none focus:outline-none transition"
                  style={{
                    background: "oklch(1 0 0 / 7%)",
                    border: `1.5px solid ${accentDim}`,
                    color: "oklch(0.88 0.005 220)",
                    lineHeight: "1.65",
                  }}
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="e.g. Your goals matter more than this."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm h-9 px-4"
                  style={{ color: "oklch(0.45 0.005 220)" }}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" className="text-sm h-9 px-4" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* ─── Actions ──────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {!isPermanent && (
              <>
                {/* Extend row */}
                <p
                  className="text-sm font-medium mb-0.5"
                  style={{ color: "oklch(0.45 0.005 220)" }}
                >
                  Need a little more time?
                </p>

                {extendStatus === "done" ? (
                  <div
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-base font-semibold"
                    style={{
                      background: "oklch(0.55 0.16 160 / 18%)",
                      border: "1.5px solid oklch(0.55 0.16 160 / 40%)",
                      color: "oklch(0.72 0.16 160)",
                    }}
                  >
                    <Check className="w-5 h-5" />
                    +{extendingMinutes}m added — enjoy!
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {([1, 5, 10] as const).map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleExtend(mins)}
                        disabled={extendStatus === "loading"}
                        className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-4 text-base font-semibold transition-all disabled:opacity-50"
                        style={{
                          background: `oklch(0.78 ${accent.c} ${accent.h} / 12%)`,
                          border: `1.5px solid oklch(0.78 ${accent.c} ${accent.h} / 45%)`,
                          color:
                            extendStatus === "loading" && extendingMinutes === mins
                              ? `oklch(0.78 ${accent.c} ${accent.h} / 50%)`
                              : accentBase,
                        }}
                      >
                        {extendStatus === "loading" && extendingMinutes === mins ? (
                          <span className="text-xl leading-none">&hellip;</span>
                        ) : (
                          <>
                            <span className="text-2xl leading-none font-bold">+{mins}</span>
                            <span className="text-xs opacity-75">min</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Countdown */}
                <div
                  className="flex items-center justify-center gap-2 mt-1 rounded-xl py-3 px-4"
                  style={{
                    background: "oklch(1 0 0 / 3%)",
                    border: "1px solid oklch(1 0 0 / 7%)",
                  }}
                >
                  <Clock className="w-4 h-4" style={{ color: "oklch(0.42 0.005 220)" }} />
                  <span className="text-sm" style={{ color: "oklch(0.42 0.005 220)" }}>
                    Resets in
                  </span>
                  <span
                    className="text-lg font-mono font-semibold tabular-nums"
                    style={{ color: accentBase }}
                  >
                    {countdown}
                  </span>
                </div>
              </>
            )}

            {isPermanent && (
              <p
                className="text-sm"
                style={{ color: "oklch(0.40 0.005 220)" }}
              >
                To regain access, remove it from your blocked list in the extension.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
