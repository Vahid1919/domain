import "@testing-library/jest-dom";

// ── Chrome storage mock ────────────────────────────────────────────────────────
// A simple in-memory store that mimics chrome.storage.local
const store: Record<string, unknown> = {};

const storageMock = {
    get: vi.fn(async (keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
            if (k in store) result[k] = store[k];
        }
        return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete store[k];
    }),
    clear: vi.fn(async () => {
        for (const k of Object.keys(store)) delete store[k];
    }),
};

(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: storageMock },
    runtime: {
        sendMessage: vi.fn(),
        lastError: null,
        getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    },
    tabs: {
        sendMessage: vi.fn(() => Promise.resolve()),
        update: vi.fn(() => Promise.resolve()),
        get: vi.fn(),
        query: vi.fn(() => Promise.resolve([])),
        onActivated: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
    },
    windows: {
        onFocusChanged: { addListener: vi.fn() },
        WINDOW_ID_NONE: -1,
    },
    alarms: {
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() },
    },
};

// Clear storage between tests so state doesn't bleed
beforeEach(async () => {
    await storageMock.clear();
    vi.clearAllMocks();
});

// Re-export the store so tests can inspect it
export { store, storageMock };
