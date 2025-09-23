// -------------------------
// Background Service Worker
// -------------------------

const ICON_PATHS = {
    enabled: {
        "16" : "icons/icon16.png",
        "24" : "icons/icon24.png",
        "32" : "icons/icon32.png",
        "48" : "icons/icon48.png",
        "64" : "icons/icon64.png",
        "128": "icons/icon128.png",
        "256": "icons/icon256.png",
        "512": "icons/icon512.png"
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
