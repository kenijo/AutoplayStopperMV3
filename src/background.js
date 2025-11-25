// -------------------------
// Background Service Worker
// -------------------------

const ICON_PATHS = {
    allowed: {
        "16": "icons/allow_16.png",
        "32": "icons/allow_32.png",
        "48": "icons/allow_48.png",
        "128": "icons/allow_128.png",
    },
    blocked: {
        "16": "icons/block_16.png",
        "32": "icons/block_32.png",
        "48": "icons/block_48.png",
        "128": "icons/block_128.png",
    },
    disabled: {
        "16": "icons/default_16.png",
        "32": "icons/default_32.png",
        "48": "icons/default_48.png",
        "128": "icons/default_128.png",
    }
};

// Default Settings
const DEFAULTS = {
    extensionEnabled: true,      // Master switch
    globalBehavior: "block",     // "block" or "allow"
    siteSettings: {}             // Map<hostname, "allow" | "block">
};

// On install, ensure default state and migrate from legacy
chrome.runtime.onInstalled.addListener(async () => {
    const syncData = await chrome.storage.sync.get(null);
    const localData = await chrome.storage.local.get(null);

    let newSettings = { ...DEFAULTS };
    let needsUpdate = false;

    // 1. Check for legacy "whitelist" (sync or local)
    const legacyWhitelist = syncData.whitelist || localData.whitelist;
    if (Array.isArray(legacyWhitelist) && legacyWhitelist.length > 0) {
        // Migrate whitelist -> siteSettings (ALLOW)
        legacyWhitelist.forEach(domain => {
            newSettings.siteSettings[domain] = "allow";
        });
        needsUpdate = true;
    }

    // 2. Check for legacy "autoplayStopperEnabled" (Master Switch)
    if (syncData.autoplayStopperEnabled !== undefined) {
        newSettings.extensionEnabled = syncData.autoplayStopperEnabled;
        needsUpdate = true;
    } else if (localData.autoplayStopperEnabled !== undefined) {
        newSettings.extensionEnabled = localData.autoplayStopperEnabled;
        needsUpdate = true;
    }

    // 3. Preserve existing new-style settings if they exist
    if (syncData.siteSettings) {
        newSettings = { ...newSettings, ...syncData };
        needsUpdate = false; // Already up to date presumably, unless we just merged legacy
    } else {
        // First time with new structure, force save
        needsUpdate = true;
    }

    if (needsUpdate) {
        // Remove legacy keys to avoid confusion? 
        // Ideally yes, but let's just overwrite with new structure.
        // We'll keep it simple and just set the new keys.
        await chrome.storage.sync.set(newSettings);
        await chrome.storage.sync.remove(["whitelist", "autoplayStopperEnabled"]); // Cleanup legacy
        console.log("Migrated settings to new format:", newSettings);
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
    if (area === "sync") {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url) {
            updateIcon(tabs[0].id, tabs[0].url);
        }
    }
});

// Core logic: set icon & title
async function updateIcon(tabId, url) {
    try {
        if (!url.startsWith("http")) {
            // Internal pages, etc.
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["disabled"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper" });
            return;
        }

        const data = await chrome.storage.sync.get(DEFAULTS);

        // 1. Master Switch
        if (!data.extensionEnabled) {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["disabled"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: Disabled" });
            return;
        }

        // 2. Determine Site Status
        const hostname = new URL(url).hostname;
        let status = data.globalBehavior; // Default

        // Check specific site settings (exact match or subdomain)
        // We need to find the most specific match. 
        // For now, let's stick to the existing logic: check if hostname ends with a key.
        // But with a map, we should probably iterate keys.
        // Optimization: If we have many keys, this is slow. But usually < 100.

        // Check for exact match or parent domain match
        // e.g. "google.com" setting applies to "mail.google.com"
        // We prioritize the longest matching suffix.

        let longestMatchLength = 0;

        for (const [domain, setting] of Object.entries(data.siteSettings)) {
            if (hostname === domain || hostname.endsWith("." + domain)) {
                if (domain.length > longestMatchLength) {
                    longestMatchLength = domain.length;
                    status = setting;
                }
            }
        }

        if (status === "allow") {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["allowed"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: Allowed" });
        } else {
            await chrome.action.setIcon({ tabId, path: ICON_PATHS["blocked"] });
            await chrome.action.setTitle({ tabId, title: "AutoplayStopper: Blocking" });
        }

    } catch (err) {
        console.error("Error updating icon:", err);
        chrome.action.setIcon({ tabId, path: ICON_PATHS["disabled"] });
    }
}
