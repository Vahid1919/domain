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

export default function AccountabilityTab() {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>
          <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
            Accountability Partner
          </h2>
        </CardTitle>
        <CardDescription>
          Set an email address to receive notifications when you exceed your
          limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col w-full items-end gap-3">
          <span className="flex flex-col gap-1.5 w-full">
            <Label htmlFor="website">Email Address</Label>
            <Input
              id="website"
              type="email"
              placeholder="friend@example.com"
              className="text-sm"
            />
          </span>
          <Button>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="#ffffff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                fill="none"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
            <p>Save Email</p>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
