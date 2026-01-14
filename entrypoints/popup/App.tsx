import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="w-96 p-2 space-y-4 bg-white rounded-md shadow-md">
      <h1 className="scroll-m-20 text-left text-4xl font-extrabold tracking-tight text-balance">
        Lamzu
      </h1>
      <h3 className="text-muted-foreground text-sm">
        Less Distraction, More Creation
      </h3>

      <Tabs defaultValue="account" className="w-full m-5">
        <TabsList className="p-2">
          <TabsTrigger value="limit">Set Limits</TabsTrigger>
          <TabsTrigger value="block">Blocked Sites</TabsTrigger>
          <TabsTrigger value="accountability">Accountability</TabsTrigger>
        </TabsList>
        <TabsContent value="limit">Limit</TabsContent>
        <TabsContent value="block">Block</TabsContent>
        <TabsContent value="accountability">Accountability</TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
