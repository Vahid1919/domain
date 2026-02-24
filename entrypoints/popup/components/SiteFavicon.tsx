import { useState } from "react";
import { Globe } from "lucide-react";

interface SiteFaviconProps {
  domain: string;
  size?: number;
  className?: string;
}

/**
 * Shows a real site favicon via Google's favicon service.
 * Falls back to a Globe icon if the image fails to load.
 */
export function SiteFavicon({
  domain,
  size = 16,
  className = "",
}: SiteFaviconProps) {
  const [error, setError] = useState(false);

  const ringStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "3px",
    boxShadow: "0 0 0 1.5px #22d3ee99",
    flexShrink: 0,
  };

  if (error) {
    return (
      <span className={className} style={ringStyle}>
        <Globe
          className="text-muted-foreground"
          style={{ width: size, height: size }}
        />
      </span>
    );
  }

  return (
    <span className={className} style={ringStyle}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size * 2}`}
        width={size}
        height={size}
        alt=""
        className="rounded-sm block"
        style={{ imageRendering: "auto" }}
        onError={() => setError(true)}
      />
    </span>
  );
}
