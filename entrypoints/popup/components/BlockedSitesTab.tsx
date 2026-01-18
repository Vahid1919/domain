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

export default function BlockedSitesTab() {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
            Blocked Sites
          </h2>
        </CardTitle>
        <CardDescription>
          Completely block access to distracting websites.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full items-end gap-3">
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="website">Website Domain</Label>
            <Input
              id="website"
              type="text"
              placeholder="e.g., youtube.com"
              className="text-sm"
            />
          </span>
          <Button>Block</Button>
        </div>
        <Separator className="mt-6" />
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
          Blocked Websites
        </h2>
        <div className="text-center text-gray-500 py-4">
          <p>No websites blocked yet.</p>
        </div>
      </CardFooter>
    </Card>
  );
}
