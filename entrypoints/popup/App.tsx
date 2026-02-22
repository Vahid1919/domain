import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, ShieldBan, Mail } from "lucide-react";
import SetLimitsTab from "./components/SetLimitsTab";
import BlockedSitesTab from "./components/BlockedSitesTab";
import AccountabilityTab from "./components/AccountabilityTab";

function App() {
  return (
    <div className="w-105 min-h-130 bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <ShieldBan className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground">
              Kill Switch
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Site access & time control
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="limit" className="flex flex-col flex-1">
        <div className="px-5 pt-3">
          <TabsList className="w-full h-9 bg-muted/60 p-0.5 rounded-lg">
            <TabsTrigger
              value="limit"
              className="flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              Limits
            </TabsTrigger>
            <TabsTrigger
              value="block"
              className="flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
            >
              <ShieldBan className="w-3.5 h-3.5" />
              Blocked
            </TabsTrigger>
            <TabsTrigger
              value="accountability"
              className="flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
            >
              <Mail className="w-3.5 h-3.5" />
              Notify
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 px-5 py-4">
          <TabsContent value="limit" className="mt-0">
            <SetLimitsTab />
          </TabsContent>
          <TabsContent value="block" className="mt-0">
            <BlockedSitesTab />
          </TabsContent>
          <TabsContent value="accountability" className="mt-0">
            <AccountabilityTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default App;
