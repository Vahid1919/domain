import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalise any user-provided domain input into a bare hostname.
 * Handles: https://www.twitter.com/home?q=1#top → twitter.com
 */
export function normalizeDomain(input: string): string {
  let s = input.trim();
  // Strip protocol (http://, https://, ftp://, etc.)
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//, "");
  // Strip everything from the first /, ?, or # onwards (path / query / hash)
  s = s.split(/[\/\?#]/)[0];
  // Strip port
  s = s.replace(/:[0-9]+$/, "");
  // Strip leading www.
  s = s.replace(/^www\./, "");
  return s.toLowerCase();
}
