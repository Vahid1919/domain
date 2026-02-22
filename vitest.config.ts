import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["lib/**/*.ts"],
        },
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "."),
        },
    },
    define: {
        // Simulate Vite env vars baked in at build time
        "import.meta.env.VITE_EMAILJS_SERVICE_ID": JSON.stringify("service_test"),
        "import.meta.env.VITE_EMAILJS_TEMPLATE_ID": JSON.stringify("template_test"),
        "import.meta.env.VITE_EMAILJS_PUBLIC_KEY": JSON.stringify("pubkey_test"),
    },
});
