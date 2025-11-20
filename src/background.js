// -------------------------
// Background Service Worker
// -------------------------

const ICON_PATHS = {
    on: {
        "16": "icons/icon16_on.png",
        "32": "icons/icon32_on.png",
        "48": "icons/icon48_on.png",
        "128": "icons/icon128_on.png",
    },
    off: {
        "16": "icons/icon16_off.png",
        "32": "icons/icon32_off.png",
        "48": "icons/icon48_off.png",
        "128": "icons/icon128_off.png",
    },
    disabled: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
    }
};

// On install, ensure default state and migrate from local to sync
chrome.runtime.onInstalled.addListener(async () => {
    // 1. Check if we have sync data
    const syncData = await chrome.storage.sync.get(["autoplayStopperEnabled", "whitelist"]);

    // 2. If sync is empty (new install or first run after update), check local
    if (syncData.autoplayStopperEnabled === undefined) {
        const localData = await chrome.storage.local.get(["autoplayStopperEnabled", "whitelist"]);

        if (localData.autoplayStopperEnabled !== undefined) {
            // Migrate local -> sync
            await chrome.storage.sync.set({
                autoplayStopperEnabled: localData.autoplayStopperEnabled,
                whitelist: localData.whitelist || []
            });
            // Optional: Clear local to avoid confusion, or keep as backup. 
            // For now, we'll leave it but future reads will use sync.
        } else {
            // New install, set defaults
            await chrome.storage.sync.set({ autoplayStopperEnabled: true, whitelist: [] });
        }
    }
});

// Update icon when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        updateIcon(tabId, tab.url);
    }
});

// Update icon when active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url) {
            updateIcon(tab.id, tab.url);
        }
    } catch (err) {
        // Tab might be closed or inaccessible
    }
});

// Update icon when storage changes
chrome.storage.onChanged.addListener(async (changes, area) => {
    // Listen to 'sync' instead of 'local'
    if (area === "sync" && (changes.autoplayStopperEnabled || changes.whitelist)) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url) {
            updateIcon(tabs[0].id, tabs[0].url);
        }
    }
});

// Core logic: set icon & title
async function updateIcon(tabId, url) {
    try {
        // Use sync storage
        const data = await chrome.storage.sync.get({ autoplayStopperEnabled: true, whitelist: [] });
        const isEnabled = data.autoplayStopperEnabled;

        if (!isEnabled) {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["disabled"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: Disabled" });
            return;
        }

        let isWhitelisted = false;
        try {
            const hostname = new URL(url).hostname;
            isWhitelisted = data.whitelist.some((d) => hostname.endsWith(d));
        } catch (e) {
            // Invalid URL, assume not whitelisted
        }

        if (isWhitelisted) {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["off"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: OFF" });
        } else {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["on"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: ON" });
        }
    } catch (err) {
        console.error("Error updating icon:", err);
        // Fallback
        chrome.action.setIcon({ tabId, path: ICON_PATHS["on"] });
        chrome.action.setTitle({ tabId, title: "AutoplayStopper" });
    }
}
