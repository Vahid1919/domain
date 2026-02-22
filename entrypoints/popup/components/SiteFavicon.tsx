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

  if (error) {
    return (
      <Globe
        className={`shrink-0 text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size * 2}`}
      width={size}
      height={size}
      alt=""
      className={`shrink-0 rounded-sm ${className}`}
      style={{ imageRendering: "auto" }}
      onError={() => setError(true)}
    />
  );
}
