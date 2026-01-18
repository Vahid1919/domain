import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SetLimitsTab from "./components/SetLimitsTab";
import BlockedSitesTab from "./components/BlockedSitesTab";
import AccountabilityTab from "./components/AccountabilityTab";

function App() {
  return (
    <div className="w-150 p-2 space-y-4 bg-white rounded-md shadow-md">
      <div className="m-5 flex flex-col gap-2">
        <h1 className="scroll-m-20 text-left text-4xl font-extrabold tracking-tight text-balance">
          Unnamed Extension
        </h1>
        <h3 className="text-muted-foreground text-sm">
          Less Distraction, More Creation
        </h3>
      </div>

      <Tabs defaultValue="limit" className="w-lg m-5">
        <TabsList className=" w-full h-10 p-2">
          <TabsTrigger value="limit">
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
            </svg>
            <p>Set Limits</p>
          </TabsTrigger>
          <TabsTrigger value="block" className="flex gap-2">
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
            </svg>
            <p>Blocked Sites</p>
          </TabsTrigger>
          <TabsTrigger value="accountability">
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
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
            <p>Accountability</p>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="limit">
          <SetLimitsTab />
        </TabsContent>
        <TabsContent value="block">
          <BlockedSitesTab />
        </TabsContent>
        <TabsContent value="accountability">
          <AccountabilityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
