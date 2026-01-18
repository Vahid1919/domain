import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Website {
  domain: string;
  limitMinutes: number;
}

export default function SetLimitsTab() {
  const [limitedDomain, setLimitedDomain] = useState<Website[]>([]);
  const [limitedDomainInput, setLimitedDomainInput] = useState("");
  const [limitedMinutesInput, setLimitedMinutesInput] = useState("");

  const addLimitedSite = (domain: string, minutes: number) => {
    setLimitedDomain([...limitedDomain, { domain, limitMinutes: minutes }]);
  };

  const removeLimitedSite = (domain: string) => {
    setLimitedDomain(limitedDomain.filter((site) => site.domain !== domain));
  };

  const handleLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Adding limit:", limitedDomainInput, limitedMinutesInput);

    if (!limitedDomainInput || !limitedMinutesInput) {
      return;
    }

    addLimitedSite(limitedDomainInput, parseInt(limitedMinutesInput, 10));

    setLimitedDomainInput("");
    setLimitedMinutesInput("");
  };

  return (
    <Card className="">
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
            Set Time Limits
          </h2>
        </CardTitle>
        <CardDescription>
          Define maximum time allowed per website per day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex w-full items-end gap-3"
          onSubmit={handleLimitSubmit}
        >
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="limit-website">Website Domain</Label>
            <Input
              id="limit-website"
              type="text"
              placeholder="e.g., youtube.com"
              value={limitedDomainInput}
              onChange={(e) => setLimitedDomainInput(e.target.value)}
              className="text-sm"
            />
          </span>
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="limit-minutes">Limit (minutes)</Label>
            <Input
              id="limit-minutes"
              type="number"
              placeholder="e.g., 30"
              value={limitedMinutesInput}
              onChange={(e) => setLimitedMinutesInput(e.target.value)}
              className="text-sm"
            />
          </span>
          <Button type="submit">Add Limit</Button>
        </form>
        <Separator className="mt-6" />
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
          Current Limits
        </h2>
        <div className="text-center text-gray-500 py-4 w-full">
          {limitedDomain.length > 0 ? (
            <ul className="space-y-2 w-full">
              {limitedDomain.map((site) => (
                <li
                  key={site.domain}
                  className="flex justify-between items-center"
                >
                  <span className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
                    {site.domain} - {site.limitMinutes} minutes/day
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeLimitedSite(site.domain)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No limits set yet.</p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
