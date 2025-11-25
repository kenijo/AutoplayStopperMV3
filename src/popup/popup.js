// -------------------------
// Popup Script
// -------------------------

const elements = {
    permAllow: document.getElementById("perm-allow"),
    permDefault: document.getElementById("perm-default"),
    permBlock: document.getElementById("perm-block"),
    permissionRadios: document.getElementsByName("site-permission"),
    currentDomain: document.getElementById("currentDomain"),
    openOptions: document.getElementById("openOptions"),
    toggleExtension: document.getElementById("toggleExtension")
};

// State
let currentHostname = "";

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Get Current Tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab && activeTab.url && activeTab.url.startsWith("http")) {
        currentHostname = new URL(activeTab.url).hostname;
        elements.currentDomain.textContent = currentHostname;
    } else {
        elements.currentDomain.textContent = "System Page";
        disableSiteControls();
    }

    // 2. Load Settings
    loadSettings();

    // 3. Listeners
    setupListeners();
});

function enableSiteControls() {
    elements.permAllow.disabled = false;
    elements.permDefault.disabled = false;
    elements.permBlock.disabled = false;
    // Visual indication is handled by CSS (opacity on label) or we can add a class
    document.querySelector('.segmented-control').style.opacity = "";
    document.querySelector('.segmented-control').style.pointerEvents = "";
}

function disableSiteControls() {
    elements.permAllow.disabled = true;
    elements.permDefault.disabled = true;
    elements.permBlock.disabled = true;
    // Visual indication is handled by CSS (opacity on label) or we can add a class
    document.querySelector('.segmented-control').style.opacity = "0.5";
    document.querySelector('.segmented-control').style.pointerEvents = "none";
}

async function loadSettings() {
    const data = await chrome.storage.sync.get({
        extensionEnabled: true,
        siteSettings: {}
    });

    // Master Switch
    elements.toggleExtension.checked = data.extensionEnabled;
    if (!data.extensionEnabled) {
        disableSiteControls();
    }

    // Site Permission Switch
    if (currentHostname) {
        const setting = data.siteSettings[currentHostname]; // "allow" | "block" | undefined
        updateSwitchState(setting);
    }
}

function updateSwitchState(setting) {
    if (setting === "allow") {
        elements.permAllow.checked = true;
    } else if (setting === "block") {
        elements.permBlock.checked = true;
    } else {
        elements.permDefault.checked = true;
    }
}

function setupListeners() {
    // Master Switch
    elements.toggleExtension.addEventListener("change", (e) => {
        chrome.storage.sync.set({ extensionEnabled: e.target.checked });
        if (e.target.checked && elements.currentDomain.textContent !== "System Page") {
            enableSiteControls();
        } else {
            disableSiteControls();
        }
    });

    // Permission Switch
    elements.permissionRadios.forEach(radio => {
        radio.addEventListener("change", async (e) => {
            if (!currentHostname) return;

            const val = e.target.value;
            const data = await chrome.storage.sync.get({ siteSettings: {} });
            let newSettings = { ...data.siteSettings };

            if (val === "allow") {
                newSettings[currentHostname] = "allow";
            } else if (val === "block") {
                newSettings[currentHostname] = "block";
            } else {
                // Default
                delete newSettings[currentHostname];
            }

            await chrome.storage.sync.set({ siteSettings: newSettings });
        });
    });

    // Options
    elements.openOptions.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}
