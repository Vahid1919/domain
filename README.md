# Kill Switch

A browser extension for managing site access and screen time. Block specific domains, set per-domain daily time budgets, and optionally notify a contact when limits are changed — all without an account or a backend.

Built with [WXT](https://wxt.dev), React 19, Tailwind CSS v4, and shadcn/ui.

---

## Features

- **Site blocking** — redirect any domain to a custom page immediately and permanently
- **Daily time budgets** — track active time per domain and redirect once the limit is reached
- **Countdown toast** — an unobtrusive on-page timer shows remaining time for the current domain
- **Change notifications** — optionally notify a designated contact via EmailJS when limits or blocks are modified
- **Customizable blocked page** — configure the message and image shown when a site is blocked
- **Keyboard shortcut** — open the popup with `Ctrl+Shift+Y` (configurable)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [pnpm](https://pnpm.io) ≥ 8

### Installation

```sh
git clone https://github.com/Vahid1919/kill-switch.git
cd kill-switch
pnpm install
```

### Environment variables (EmailJS)

The notification email feature is powered by [EmailJS](https://www.emailjs.com), which sends emails directly from the browser — no backend required. The credentials are baked into the extension at build time and are **never stored** in `chrome.storage` or exposed in the UI.

1. Copy the example file:

   ```sh
   cp .env.example .env
   ```

2. Fill in your credentials from the [EmailJS dashboard](https://dashboard.emailjs.com):

   ```dotenv
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   ```

> **Note:** The `.env` file is gitignored and must never be committed. If you fork this repo, you must supply your own EmailJS credentials — the extension will silently skip email sending if the env vars are absent.

### Development

```sh
pnpm dev          # Chrome (MV3)
pnpm dev:firefox  # Firefox
```

This opens a browser with the extension pre-loaded and live-reloads on save.

### Build and package

```sh
pnpm build          # Chrome production build → .output/chrome-mv3/
pnpm build:firefox  # Firefox production build

pnpm zip            # Chrome — creates a distributable .zip
pnpm zip:firefox    # Firefox
```

---

## Running tests

```sh
pnpm test           # Run once
pnpm test:watch     # Watch mode
pnpm test:coverage  # Coverage report
```

Tests cover storage helpers, email send logic, and the background service-worker tick/redirect logic. They run in [happy-dom](https://github.com/capricorn86/happy-dom) via [Vitest](https://vitest.dev) with a chrome API stub.

---

## Project structure

```
entrypoints/
  background/   – Service worker: tab tracking, time limiting, blocking, email dispatch
  content.ts    – Injected into every page: displays the countdown toast
  popup/        – Extension popup (React): Limits, Blocked Sites, Accountability tabs
  blocked/      – Full-page "site blocked / limit reached" screen
lib/
  storage.ts    – Typed chrome.storage helpers
  email.ts      – EmailJS send logic and event templates
  background-helpers.ts – Pure functions extracted for testability
tests/          – Vitest test suite
```

---

## Security notes

- **EmailJS credentials** — The public key, service ID, and template ID are client-side credentials embedded in the compiled extension bundle (this is the standard EmailJS browser usage pattern). They are scoped to your EmailJS account's send quota and the specific template you configure. Never commit your `.env` file.
- **No remote data collection** — All user data (blocked sites, limits, usage stats, accountability settings) is stored locally in `chrome.storage.local` and never leaves the browser.
- **Permissions** — The extension requests `storage`, `tabs`, and `alarms`. `host_permissions: <all_urls>` is required to intercept navigations across all sites.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

1. Fork the repo and create a feature branch
2. Follow the existing TypeScript + ESLint style
3. Add or update tests where appropriate
4. Open a PR against `main`

---

## License

MIT
