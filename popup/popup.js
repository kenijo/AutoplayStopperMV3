// Initialize buttons
const toggleGlobalBtn = document.getElementById("toggleGlobal");
const toggleSiteBtn = document.getElementById("toggleSite");
const openOptionsBtn = document.getElementById("openOptions");


// Load state
chrome.storage.local.get({ autoplayStopperEnabled: true, whitelist: [] }, (data) => {
    toggleGlobalBtn.textContent = data.autoplayStopperEnabled
        ? "Disable Globally"
        : "Enable Globally";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url) return;

        toggleSiteBtn.style.display = "block";

        const hostname = new URL(tabs[0].url).hostname;
        const isWhitelisted = data.whitelist.some((d) => hostname.endsWith(d));
        toggleSiteBtn.textContent = isWhitelisted
            ? "Remove from Whitelist"
            : "Add to Whitelist";
    });
});

// Toggle global
toggleGlobalBtn.addEventListener("click", () => {
    chrome.storage.local.get({ autoplayStopperEnabled: true }, (data) => {
        const newState = !data.autoplayStopperEnabled;
        chrome.storage.local.set({ autoplayStopperEnabled: newState }, () => {
            toggleGlobalBtn.textContent = newState ? "Disable Globally" : "Enable Globally";
        });
    });
});

// Toggle site
toggleSiteBtn.addEventListener("click", () => {
    chrome.storage.local.get({ whitelist: [] }, (data) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].url) return;
            const hostname = new URL(tabs[0].url).hostname;
            let whitelist = data.whitelist;

            if (whitelist.some((d) => hostname.endsWith(d))) {
                whitelist = whitelist.filter((d) => !hostname.endsWith(d));
                toggleSiteBtn.textContent = "Add to Whitelist";
            } else {
                whitelist.push(hostname);
                toggleSiteBtn.textContent = "Remove from Whitelist";
            }

            chrome.storage.local.set({ whitelist });
        });
    });
});

// Open options page
openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
