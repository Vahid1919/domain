import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ShieldBan, Mail, Sun, Moon, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SetLimitsTab from "./components/SetLimitsTab";
import BlockedSitesTab from "./components/BlockedSitesTab";
import AccountabilityTab from "./components/AccountabilityTab";
import {
  getAccountabilitySettings,
  saveAccountabilitySettings,
} from "@/lib/storage";

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
  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    getAccountabilitySettings().then((s) => setName(s.name ?? ""));
  }, []);

  const handleNameSave = async () => {
    setIsEditingName(false);
    const current = await getAccountabilitySettings();
    await saveAccountabilitySettings({ ...current, name });
  };

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
    <div className="w-110 bg-background text-foreground flex flex-col relative" style={{ overflowY: "scroll" }}>
      {/* Header */}
      <div className="bg-card">
        <div className="px-5 pt-5 pb-4 relative">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-[30px] font-bold leading-tight neon-red">
                Domain
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono tracking-widest uppercase">
                focus &bull; limits &bull; accountability
              </p>
              <div className="mt-2">
                <AnimatePresence mode="wait" initial={false}>
                  {isEditingName ? (
                    <motion.div
                      key="name-input"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                    >
                      <input
                        autoFocus
                        aria-label="Your name"
                        className="text-xs font-mono bg-transparent border-b border-primary/50 text-foreground outline-none placeholder:text-muted-foreground w-36"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                        placeholder="your name"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="name-button"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                    >
                      <button
                        onClick={() => setIsEditingName(true)}
                        aria-label={
                          name
                            ? `Edit name (currently ${name})`
                            : "Set your name"
                        }
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span>{name ? `Hey, ${name} 👋` : "Who are you?"}</span>
                        <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <motion.button
              onClick={() => setIsDark((d) => !d)}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 700, damping: 18 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isDark ? "sun" : "moon"}
                  initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
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
      </div>

      {/* Tab bar — Radix Tabs used only for the trigger UI */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex flex-col sticky top-0 z-10 bg-background"
      >
        <div className="px-5 py-3 shrink-0">
          <TabsList className="flex w-full h-10 bg-muted/40 p-0.5 rounded-lg border border-border">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-1 h-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground transition-all duration-200 hover:text-primary active:scale-95"
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
            initial={{ opacity: 0, y: 14, scale: 0.97, filter: "blur(3px)" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              transition: { duration: 0.26, ease: [0.34, 1.2, 0.64, 1] },
            }}
            exit={{
              opacity: 0,
              y: -10,
              scale: 0.97,
              filter: "blur(3px)",
              transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
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
