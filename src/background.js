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

// On install, ensure default state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get({ autoplayStopperEnabled: null }, (data) => {
        if (data.autoplayStopperEnabled === null) {
            chrome.storage.local.set({ autoplayStopperEnabled: true });
        }
    });
});

// Update icon when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        updateIcon(tabId, tab.url);
    }
});

// Update icon when active tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
            updateIcon(tab.id, tab.url);
        }
    });
});

// Update icon whenever storage changes (global toggle or whitelist)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.autoplayStopperEnabled || changes.whitelist)) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                updateIcon(tabs[0].id, tabs[0].url);
            }
        });
    }
});

// Core logic: set icon & title
function updateIcon(tabId, url) {
    chrome.storage.local.get({ autoplayStopperEnabled: true, whitelist: [] }, (data) => {
        const isEnabled = data.autoplayStopperEnabled;

        if (!isEnabled) {
            chrome.action.setIcon({ tabId, path: ICON_PATHS["disabled"] });
            chrome.action.setTitle({ tabId, title: "AutoplayStopper: Disabled" });
            return;
        }

        try {
            const hostname = new URL(url).hostname;
            const isWhitelisted = data.whitelist.some((d) => hostname.endsWith(d));

            if (isWhitelisted) {
                chrome.action.setIcon({ tabId, path: ICON_PATHS["off"] });
                chrome.action.setTitle({ tabId, title: "AutoplayStopper: OFF" });
            } else {
                chrome.action.setIcon({ tabId, path: ICON_PATHS["on"] });
                chrome.action.setTitle({ tabId, title: "AutoplayStopper: ON" });
            }
        } catch (err) {
            // fallback if URL parsing fails
            chrome.action.setIcon({ tabId, path: ICON_PATHS["on"] });
            chrome.action.setTitle({ tabId, title: "AutoplayStopper" });
        }
    });
}
