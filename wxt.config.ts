import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
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
