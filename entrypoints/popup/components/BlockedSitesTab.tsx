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
import { ShieldBan, Globe, X } from "lucide-react";
import { getBlockedSites, saveBlockedSites } from "@/lib/storage";
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
    const domain = domainInput.trim().replace(/^www\./, "");
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
          <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
            Blocked Sites
          </h2>
        </CardTitle>
        <CardDescription>
          Completely block access to distracting websites at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form className="flex w-full items-end gap-3" onSubmit={handleBlock}>
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="block-website">Website Domain</Label>
            <Input
              id="block-website"
              type="text"
              placeholder="e.g., twitter.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="text-sm"
            />
          </span>
          <Button type="submit" variant="destructive">
            Block
          </Button>
        </form>

        <Separator />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Blocked Websites
          </h2>

          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
              <ShieldBan className="w-8 h-8 opacity-40" />
              <p className="text-sm">No sites blocked yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sites.map((site) => (
                <li key={site.domain}>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {site.domain}
                      </span>
                      <span className="ml-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
                        Blocked
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
