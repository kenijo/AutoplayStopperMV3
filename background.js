// -------------------------
// Background Service Worker
// -------------------------

let enabled = true;

// Load saved state from storage at startup
chrome.storage.local.get("autoplayBlockerEnabled", (data) => {
    if (typeof data.autoplayBlockerEnabled === "boolean") {
        enabled = data.autoplayBlockerEnabled;
    }
    updateIcon();
});

// When the toolbar button is clicked
chrome.action.onClicked.addListener((tab) => {
    enabled = !enabled;

    // Save new state
    chrome.storage.local.set({ autoplayBlockerEnabled: enabled });

    // Update toolbar icon/title
    updateIcon();

    // Notify the active tab so content.js updates immediately
    if (tab && tab.id >= 0) {
        chrome.tabs.sendMessage(tab.id, { autoplayBlockerEnabled: enabled }).catch(() => {
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
                "32": "icons/icon32.png",
                "48": "icons/icon48.png"
            }
            : {
                "16": "icons/icon16_disabled.png",
                "32": "icons/icon32_disabled.png",
                "48": "icons/icon48_disabled.png"
            }
    });

    chrome.action.setTitle({
        title: enabled ? "AutoplayStopper ON" : "AutoplayStopper OFF"
    });
}
