import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ShieldBan, Mail, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SetLimitsTab from "./components/SetLimitsTab";
import BlockedSitesTab from "./components/BlockedSitesTab";
import AccountabilityTab from "./components/AccountabilityTab";

const tabs = [
  { value: "limit", label: "Limits", icon: Clock, component: SetLimitsTab },
  {
    value: "block",
    label: "Block",
    icon: ShieldBan,
    component: BlockedSitesTab,
  },
  {
    value: "accountability",
    label: "Notify",
    icon: Mail,
    component: AccountabilityTab,
  },
] as const;

type TabValue = (typeof tabs)[number]["value"];

function App() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("ks-theme");
    return stored ? stored === "dark" : true;
  });
  const [activeTab, setActiveTab] = useState<TabValue>("limit");

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem("ks-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const ActiveComponent = tabs.find((t) => t.value === activeTab)!.component;

  return (
    <div className="w-[440px] bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="relative px-5 pt-5 pb-4 bg-card">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-pixel text-[22px] leading-tight text-foreground dark:text-primary dark:glow-text">
              Tab Limit
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-mono tracking-widest uppercase">
              site access &amp; time control
            </p>
          </div>
          <motion.button
            onClick={() => setIsDark((d) => !d)}
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "sun" : "moon"}
                initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Tab bar — Radix Tabs used only for the trigger UI */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex flex-col"
      >
        <div className="px-5 pt-4 shrink-0">
          <TabsList className="w-full h-10 bg-muted/40 p-0.5 rounded-md border border-border">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-1 h-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground transition-all duration-200"
              >
                <Icon className="w-4 h-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Animated content — completely decoupled from Radix TabsContent */}
      <div className="px-5 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.16, ease: "easeOut" },
            }}
            exit={{
              opacity: 0,
              y: -6,
              transition: { duration: 0.1, ease: "easeIn" },
            }}
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
