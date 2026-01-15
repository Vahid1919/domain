import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardAction,
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

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="w-150 p-2 space-y-4 bg-white rounded-md shadow-md">
      <h1 className="scroll-m-20 text-left text-4xl font-extrabold tracking-tight text-balance">
        Unnamed Extension
      </h1>
      <h3 className="text-muted-foreground text-sm">
        Less Distraction, More Creation
      </h3>

      <Tabs defaultValue="limit" className="w-lg m-5">
        <TabsList className=" w-full p-2">
          <TabsTrigger value="limit">
            {" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="#000000"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                fill="none"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0"
              />
            </svg>{" "}
            Set Limits
          </TabsTrigger>
          <TabsTrigger value="block">
            {" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              width="24"
              height="24"
              fill="#000000"
            >
              <path
                fill-rule="evenodd"
                d="M3.05 3.05a7 7 0 1 1 9.9 9.9a7 7 0 0 1-9.9-9.9m1.627.566l7.707 7.707a5.501 5.501 0 0 0-7.707-7.707m6.646 8.768L3.616 4.677a5.501 5.501 0 0 0 7.707 7.707"
                clip-rule="evenodd"
              />
            </svg>{" "}
            Blocked Sites
          </TabsTrigger>
          <TabsTrigger value="accountability">
            {" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="#000000"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                fill="none"
                d="M15 19.128a9.4 9.4 0 0 0 2.625.372a9.3 9.3 0 0 0 4.121-.952q.004-.086.004-.173a4.125 4.125 0 0 0-7.536-2.32M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.3 12.3 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0a3.375 3.375 0 0 1 6.75 0m8.25 2.25a2.625 2.625 0 1 1-5.25 0a2.625 2.625 0 0 1 5.25 0"
              />
            </svg>{" "}
            Accountability
          </TabsTrigger>
        </TabsList>
        <TabsContent value="limit">
          <Card className="">
            <CardHeader>
              <CardTitle>
                {" "}
                <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
                  Set Time Limits
                </h2>
              </CardTitle>
              <CardDescription>
                Define maximum time allowed per website per day.
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
                <span className="flex flex-col gap-1.5 w-full">
                  <Label htmlFor="minutes">Limit (minutes)</Label>
                  <Input
                    id="minutes"
                    type="number"
                    placeholder="e.g., 30"
                    className="text-sm"
                  />
                </span>

                <Button>Add Limit</Button>
              </div>
              <Separator className="mt-6" />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <h2 className="scroll-m-20 text-left self-start text-lg font-extrabold tracking-tight text-balance">
                Current Limits
              </h2>
              <div className="text-center text-gray-500 py-4">
                <p>No limits set yet.</p>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="block">Block</TabsContent>
        <TabsContent value="accountability">Accountability</TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
