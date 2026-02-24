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
import { ShieldBan, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SiteFavicon } from "./SiteFavicon";
import { getBlockedSites, saveBlockedSites } from "@/lib/storage";
import { normalizeDomain } from "@/lib/utils";
import type { BlockedSite } from "@/lib/storage";

function sendEmailEvent(
  event: "block_added" | "block_removed",
  domain: string,
) {
  chrome.runtime.sendMessage({ type: "EMAIL_EVENT", event, domain });
}

export default function BlockedSitesTab() {
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [domainInput, setDomainInput] = useState("");

  useEffect(() => {
    getBlockedSites().then(setSites);
  }, []);

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalizeDomain(domainInput);
    if (!domain || sites.find((s) => s.domain === domain)) return;
    const next = [...sites, { domain }];
    setSites(next);
    await saveBlockedSites(next);
    sendEmailEvent("block_added", domain);
    setDomainInput("");
  };

  const handleRemove = async (domain: string) => {
    const next = sites.filter((s) => s.domain !== domain);
    setSites(next);
    await saveBlockedSites(next);
    sendEmailEvent("block_removed", domain);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold text-left self-start">
            Blocked Sites
          </h2>
        </CardTitle>
        <CardDescription>
          Completely block access to distracting websites at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex w-full items-end gap-3" onSubmit={handleBlock}>
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="block-website">Website Domain</Label>
            <Input
              id="block-website"
              type="text"
              placeholder="e.g., twitter.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="text-base"
            />
          </span>
          <Button type="submit" variant="destructive">
            Block
          </Button>
        </form>

        <Separator />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Blocked Websites
          </h3>

          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
              <ShieldBan className="w-8 h-8 text-primary opacity-50" />
              <p className="text-base">No sites blocked yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {sites.map((site) => (
                  <motion.li
                    key={site.domain}
                    layout="position"
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: -24,
                      scale: 0.94,
                      transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                    }}
                    transition={{ duration: 0.3, ease: [0.34, 1.4, 0.64, 1] }}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <SiteFavicon domain={site.domain} size={16} />
                        <span className="font-medium text-base truncate">
                          {site.domain}
                        </span>
                        <span className="ml-1 shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
                          Blocked
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive btn-glow-ghost-destructive"
                        aria-label={`Unblock ${site.domain}`}
                        onClick={() => handleRemove(site.domain)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
