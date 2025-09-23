// -------------------------
// Background Service Worker
// -------------------------

const ICON_PATHS = {
    enabled: {
        "16" : "icons/icon16_enabled.png",
        "24" : "icons/icon24_enabled.png",
        "32" : "icons/icon32_enabled.png",
        "48" : "icons/icon48_enabled.png",
        "64" : "icons/icon64_enabled.png",
        "128": "icons/icon128_enabled.png",
        "256": "icons/icon256_enabled.png",
        "512": "icons/icon512_enabled.png"
    },
    disabled: {
        "16" : "icons/icon16_disabled.png",
        "24" : "icons/icon24_disabled.png",
        "32" : "icons/icon32_disabled.png",
        "48" : "icons/icon48_disabled.png",
        "64" : "icons/icon64_disabled.png",
        "128": "icons/icon128_disabled.png",
        "256": "icons/icon256_disabled.png",
        "512": "icons/icon512_disabled.png"
    }
    ,
    whitelisted: {
        "16" : "icons/icon16_whitelisted.png",
        "24" : "icons/icon24_whitelisted.png",
        "32" : "icons/icon32_whitelisted.png",
        "48" : "icons/icon48_whitelisted.png",
        "64" : "icons/icon64_whitelisted.png",
        "128": "icons/icon128_whitelisted.png",
        "256": "icons/icon256_whitelisted.png",
        "512": "icons/icon512_whitelisted.png"
    }
};

let enabled = true;

// --- Initialize ---
chrome.storage.local.get("AutoplayStopperEnabled", ({ AutoplayStopperEnabled }) => {
    if (typeof AutoplayStopperEnabled === "boolean") {
        enabled = AutoplayStopperEnabled;
    }
    updateUI();
});

// --- Toggle Handler ---
chrome.action.onClicked.addListener(async (tab) => {
    enabled = !enabled;

    // Save state and update UI
    await chrome.storage.local.set({ AutoplayStopperEnabled: enabled });
    updateUI();

    // Notify active tab if valid
    if (tab?.id >= 0) {
        try {
            await chrome.tabs.sendMessage(tab.id, { AutoplayStopperEnabled: enabled });
        } catch {
            // Silently fail if content script not ready
        }
    }
});

// --- UI Update ---
function updateUI() {
    chrome.action.setIcon({ path: ICON_PATHS[enabled ? "enabled" : "disabled"] });
    chrome.action.setTitle({
        title: `AutoplayStopper ${enabled ? "ON" : "OFF"}`
    });
}
