import { useEffect, useState } from "react";
import {
  getLimitedSites,
  getMotivationalSettings,
  saveMotivationalSettings,
} from "@/lib/storage";
import type { MotivationalSettings } from "@/lib/storage";
import { Check, Pencil, Clock } from "lucide-react";

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

  return (
    <div style={{
      background: "#0a0a0a",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: "#111111",
        border: "1px solid #1f1f1f",
        borderRadius: "16px",
        padding: "40px 36px",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
          {isPermanent ? "🚫" : "⏰"}
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "10px", color: "#e0e0e0" }}>
          {isPermanent ? "Site Blocked" : "Time's Up"}
        </h1>

        {/* Domain */}
        <p style={{ fontSize: "0.95rem", color: "#707070", lineHeight: 1.6, marginBottom: "6px" }}>
          {isPermanent
            ? <>This site is off-limits.<br /><span style={{ color: "#505050", fontSize: "0.85rem", fontFamily: "monospace" }}>{domain}</span></>
            : <>You've used your daily limit for <span style={{ color: "#505050", fontSize: "0.85rem", fontFamily: "monospace" }}>{domain}</span>.</>
          }
        </p>

        {!isPermanent && limitMinutes !== null && (
          <p style={{ fontSize: "0.85rem", color: "#505050", marginBottom: "0", lineHeight: 1.6 }}>
            Daily allowance: <span style={{ color: "#808080" }}>{formatMinutes(limitMinutes)}</span>
          </p>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #1f1f1f", margin: "28px 0" }} />

        {/* Motivational message */}
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid #1f1f1f",
              borderRadius: "10px",
              padding: "16px 20px",
              cursor: "pointer",
              textAlign: "left",
              marginBottom: "24px",
            }}
          >
            <p style={{ fontSize: "0.9rem", color: "#606060", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>
              &ldquo;{settings.text || "Add a personal note to keep yourself on track…"}&rdquo;
            </p>
            <p style={{ fontSize: "0.75rem", color: "#3a3a3a", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
              <Pencil style={{ width: "12px", height: "12px" }} /> Edit message
            </p>
          </button>
        ) : (
          <div style={{
            border: "1px solid #1f1f1f",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
            textAlign: "left",
          }}>
            <textarea
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="e.g. Your goals matter more than this."
              style={{
                width: "100%",
                background: "#0a0a0a",
                border: "1px solid #1f1f1f",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e0e0e0",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
              <button
                onClick={() => setEditing(false)}
                style={{ background: "none", border: "none", color: "#505050", fontSize: "0.85rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  background: "#1f1f1f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  fontSize: "0.85rem",
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Extend buttons (limit only) */}
        {!isPermanent && (
          <>
            <p style={{ fontSize: "0.8rem", color: "#505050", marginBottom: "12px" }}>Need a little more time?</p>

            {extendStatus === "done" ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                background: "#0d2318", border: "1px solid #1a4a2e", borderRadius: "10px",
                padding: "14px", color: "#22c55e", fontSize: "0.9rem", fontWeight: 500,
                marginBottom: "20px",
              }}>
                <Check style={{ width: "16px", height: "16px" }} />
                +{extendingMinutes}m added — enjoy!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                {([1, 5, 10] as const).map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleExtend(mins)}
                    disabled={extendStatus === "loading"}
                    style={{
                      background: "#111111",
                      border: "1px solid #1f1f1f",
                      borderRadius: "10px",
                      padding: "14px 0",
                      color: extendStatus === "loading" && extendingMinutes === mins ? "#3a3a3a" : "#e0e0e0",
                      cursor: extendStatus === "loading" ? "default" : "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {extendStatus === "loading" && extendingMinutes === mins
                      ? "…"
                      : <><span style={{ display: "block", fontSize: "1.3rem", fontWeight: 700 }}>+{mins}</span><span style={{ fontSize: "0.75rem", color: "#505050" }}>min</span></>
                    }
                  </button>
                ))}
              </div>
            )}

            {/* Countdown */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              borderTop: "1px solid #1f1f1f", paddingTop: "20px",
              color: "#505050", fontSize: "0.85rem",
            }}>
              <Clock style={{ width: "14px", height: "14px" }} />
              Resets in <span style={{ fontFamily: "monospace", color: "#808080", fontWeight: 600, marginLeft: "4px" }}>{countdown}</span>
            </div>
          </>
        )}

        {isPermanent && (
          <p style={{ fontSize: "0.8rem", color: "#505050" }}>
            To regain access, remove it from your blocked list in the extension.
          </p>
        )}
      </div>
    </div>
  );
}
