import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Tab Limit",
    description: "Block distracting sites, set time limits, and keep your accountability partner in the loop.",
    permissions: ["storage", "tabs", "alarms"],
    host_permissions: ["<all_urls>"],
    commands: {
      open_dashboard: {
        suggested_key: {
          default: "Ctrl+Shift+Y",
        },
        description: "Open dashboard",
      },
    },
  },
});
