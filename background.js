// -------------------------
// Background Service Worker
// -------------------------

let enabled = true;

// Load saved state from storage at startup
chrome.storage.local.get("AutoplayStopperEnabled", (data) => {
    if (typeof data.AutoplayStopperEnabled === "boolean") {
        enabled = data.AutoplayStopperEnabled;
    }
    updateIcon();
});

// When the toolbar button is clicked
chrome.action.onClicked.addListener((tab) => {
    enabled = !enabled;

    // Save new state
    chrome.storage.local.set({ AutoplayStopperEnabled: enabled });

    // Update toolbar icon/title
    updateIcon();

    // Notify the active tab so content.js updates immediately
    if (tab && tab.id >= 0) {
        chrome.tabs.sendMessage(tab.id, { AutoplayStopperEnabled: enabled }).catch(() => {
            // Ignore if no content script is injected yet
        });
    }
});

// -------------------------
// Helpers
// -------------------------

function updateIcon() {
    chrome.action.setIcon({
        path: enabled
            ? {
                "16": "icons/icon16.png",
                "24": "icons/icon24.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png",
                "64": "icons/icon64.png",
                "128": "icons/icon128.png",
                "256": "icons/icon256.png",
                "512": "icons/icon512.png"
            }
            : {
                "16": "icons/icon16_disabled.png",
                "24": "icons/icon24_disabled.png",
                "32": "icons/icon32_disabled.png",
                "48": "icons/icon48_disabled.png",
                "64": "icons/icon64_disabled.png",
                "128": "icons/icon128_disabled.png",
                "256": "icons/icon256_disabled.png",
                "512": "icons/icon512_disabled.png"
            }
    });

    chrome.action.setTitle({
        title: enabled ? "AutoplayStopper ON" : "AutoplayStopper OFF"
    });
}
