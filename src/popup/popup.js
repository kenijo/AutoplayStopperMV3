// -------------------------
// Popup Script
// -------------------------

const elements = {
    btnAllow: document.getElementById("btnAllow"),
    btnBlock: document.getElementById("btnBlock"),
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

function disableSiteControls() {
    elements.btnAllow.disabled = true;
    elements.btnBlock.disabled = true;
    elements.btnAllow.style.opacity = "0.5";
    elements.btnBlock.style.opacity = "0.5";
}

async function loadSettings() {
    const data = await chrome.storage.sync.get({
        extensionEnabled: true,
        siteSettings: {}
    });

    // Master Switch
    elements.toggleExtension.checked = data.extensionEnabled;

    // Site Buttons
    if (currentHostname) {
        const setting = data.siteSettings[currentHostname]; // "allow" | "block" | undefined
        updateButtonStates(setting);
    }
}

function updateButtonStates(setting) {
    // Reset classes
    elements.btnAllow.classList.remove("active-allow");
    elements.btnBlock.classList.remove("active-block");

    if (setting === "allow") {
        elements.btnAllow.classList.add("active-allow");
    } else if (setting === "block") {
        elements.btnBlock.classList.add("active-block");
    }
}

function setupListeners() {
    // Master Switch
    elements.toggleExtension.addEventListener("change", (e) => {
        chrome.storage.sync.set({ extensionEnabled: e.target.checked });
    });

    // Allow Button
    elements.btnAllow.addEventListener("click", async () => {
        if (!currentHostname) return;

        const data = await chrome.storage.sync.get({ siteSettings: {} });
        const currentSetting = data.siteSettings[currentHostname];

        let newSettings = { ...data.siteSettings };

        if (currentSetting === "allow") {
            // Toggle OFF (remove setting)
            delete newSettings[currentHostname];
            updateButtonStates(undefined);
        } else {
            // Set to ALLOW
            newSettings[currentHostname] = "allow";
            updateButtonStates("allow");
        }

        await chrome.storage.sync.set({ siteSettings: newSettings });
    });

    // Block Button
    elements.btnBlock.addEventListener("click", async () => {
        if (!currentHostname) return;

        const data = await chrome.storage.sync.get({ siteSettings: {} });
        const currentSetting = data.siteSettings[currentHostname];

        let newSettings = { ...data.siteSettings };

        if (currentSetting === "block") {
            // Toggle OFF (remove setting)
            delete newSettings[currentHostname];
            updateButtonStates(undefined);
        } else {
            // Set to BLOCK
            newSettings[currentHostname] = "block";
            updateButtonStates("block");
        }

        await chrome.storage.sync.set({ siteSettings: newSettings });
    });

    // Options
    elements.openOptions.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}
