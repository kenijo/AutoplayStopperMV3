// -------------------------
// Popup Script (with Live Updates)
// -------------------------

// Initialize buttons
const bodyStyle = window.getComputedStyle(document.body);
const currentDomainBtn = document.getElementById("currentDomain");
const openOptionsBtn = document.getElementById("openOptions");
const toggleGlobalBtn = document.getElementById("toggleGlobal");
const toggleSiteBtn = document.getElementById("toggleSite");

// Load state
chrome.storage.sync.get({ autoplayStopperEnabled: true, whitelist: [] }, (data) => {
    toggleGlobalBtn.textContent = data.autoplayStopperEnabled ? "Globally Enabled" : "Globally Disabled";
    toggleGlobalBtn.style.backgroundColor = data.autoplayStopperEnabled
        ? bodyStyle.getPropertyValue('--color_primary')
        : bodyStyle.getPropertyValue('--color_dark');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // since only one tab should be active and in the current window at once
        // the return variable should only have one entry
        var activeTab = tabs[0];

        if (!activeTab || !activeTab.url) return;

        // Disabled on internal pages
        if (!activeTab.url.startsWith("http://") && !activeTab.url.startsWith("https://")
        ) {
            toggleSiteBtn.style.display = "none";
            return;
        }

        const hostname = new URL(activeTab.url).hostname;
        const isWhitelisted = data.whitelist.some((d) => hostname.endsWith(d));
        currentDomainBtn.textContent = hostname;
        toggleSiteBtn.textContent = isWhitelisted ? "Remove from Whitelist" : "Add to Whitelist";
    });
});

// Toggle site
toggleSiteBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ whitelist: [] }, (data) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            var activeTab = tabs[0];

            if (!activeTab || !activeTab.url) return;
            const hostname = new URL(activeTab.url).hostname;
            let whitelist = data.whitelist;

            let added;
            if (whitelist.some((d) => hostname.endsWith(d))) {
                whitelist = whitelist.filter((d) => !hostname.endsWith(d));
                toggleSiteBtn.textContent = "Add to Whitelist";
                added = false;
            } else {
                whitelist.push(hostname);
                toggleSiteBtn.textContent = "Remove from Whitelist";
                added = true;
            }

            chrome.storage.sync.set({ whitelist }, () => {
                // Flash a color briefly to indicate change
                toggleSiteBtn.style.backgroundColor = added
                    ? bodyStyle.getPropertyValue('--color_secondary') // green if added
                    : bodyStyle.getPropertyValue('--color_danger');   // red if removed
                setTimeout(() => {
                    toggleSiteBtn.style.backgroundColor = bodyStyle.getPropertyValue('--color_primary');
                }, 400);
            });
        });
    });
});

// Toggle global enable/disable
toggleGlobalBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ autoplayStopperEnabled: true }, (data) => {
        const newState = !data.autoplayStopperEnabled;
        chrome.storage.sync.set({ autoplayStopperEnabled: newState }, () => {
            toggleGlobalBtn.textContent = newState ? "Globally Enabled" : "Globally Disabled";
            toggleGlobalBtn.style.backgroundColor = newState
                ? bodyStyle.getPropertyValue('--color_primary')
                : bodyStyle.getPropertyValue('--color_dark');
        });
    });
});

// Open options page
openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
