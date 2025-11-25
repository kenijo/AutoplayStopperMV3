// -------------------------
// Options Page
// -------------------------

// DOM Elements
const elements = {
    addButton: document.getElementById("addDomain"),
    domainInput: document.getElementById("domainInput"),
    domainList: document.getElementById("domainList"),
    exportBtn: document.getElementById("exportBtn"),
    globalBehavior: document.getElementById("globalBehavior"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    newDomainStatus: document.getElementById("newDomainStatus"),
    resetBtn: document.getElementById("resetBtn"),
    searchInput: document.getElementById("searchInput")
};

// State
let siteSettings = {}; // Map<domain, "allow"|"block">

// -------------------------
// Utilities
// -------------------------

function showMessage(text, isError = true) {
    const toast = document.getElementById("toast");
    const bodyStyle = window.getComputedStyle(document.body)

    toast.textContent = text;
    toast.style.backgroundColor = isError ? bodyStyle.getPropertyValue('--color_danger') : bodyStyle.getPropertyValue('--color_primary');

    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function isValidDomain(domain) {
    domain = domain.trim().toLowerCase();
    if (domain === "localhost") return true;
    if (domain.endsWith(".local")) return true;
    return /^(?!-)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(domain);
}

// -------------------------
// Logic
// -------------------------

function renderList(filter = "") {
    elements.domainList.innerHTML = "";

    const entries = Object.entries(siteSettings)
        .filter(([domain]) => domain.toLowerCase().includes(filter.toLowerCase()))
        .sort(([a], [b]) => a.localeCompare(b));

    entries.forEach(([domain, status]) => {
        const li = document.createElement("li");
        li.className = "domain-item";

        const info = document.createElement("span");
        info.className = "domain-info";
        info.innerHTML = `<span class="status-badge ${status}">${status.toUpperCase()}</span><strong>${domain}</strong>`;

        const actions = document.createElement("div");
        actions.className = "actions";

        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = status === "allow" ? "Block" : "Allow";
        toggleBtn.className = "btn btn-small";
        toggleBtn.onclick = () => updateDomainStatus(domain, status === "allow" ? "block" : "allow");

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "btn btn-danger btn-small";
        removeBtn.onclick = () => removeDomain(domain);

        actions.append(toggleBtn, removeBtn);
        li.append(info, actions);
        elements.domainList.appendChild(li);
    });
}

async function updateDomainStatus(domain, status) {
    siteSettings[domain] = status;
    await chrome.storage.sync.set({ siteSettings });
    renderList(elements.searchInput.value);
}

async function removeDomain(domain) {
    delete siteSettings[domain];
    await chrome.storage.sync.set({ siteSettings });
    renderList(elements.searchInput.value);
    showMessage(`Removed ${domain}`, false);
}

async function addDomain() {
    let domain = elements.domainInput.value.trim();
    const status = elements.newDomainStatus.value;

    if (!domain) {
        showMessage("Please enter a domain");
        return;
    }

    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!isValidDomain(domain)) {
        showMessage("Invalid domain format");
        return;
    }

    siteSettings[domain] = status;
    await chrome.storage.sync.set({ siteSettings });

    elements.domainInput.value = "";
    renderList(elements.searchInput.value);
    showMessage(`Added ${domain} as ${status.toUpperCase()}`, false);
}

// -------------------------
// Import/Export
// -------------------------

function exportSettings() {
    const data = {
        siteSettings,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autoplaystopper-settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage("Settings exported", false);
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imported = JSON.parse(event.target.result);

            // Support legacy import (array of strings)
            let newSettings = {};
            if (Array.isArray(imported)) {
                imported.forEach(d => {
                    if (typeof d === "string" && isValidDomain(d)) newSettings[d] = "allow";
                });
            } else if (imported.siteSettings) {
                newSettings = imported.siteSettings;
            } else {
                throw new Error("Invalid format");
            }

            if (Object.keys(newSettings).length === 0) {
                showMessage("No valid settings found");
                return;
            }

            if (confirm("Overwrite current settings? Cancel to merge.")) {
                siteSettings = newSettings;
            } else {
                siteSettings = { ...siteSettings, ...newSettings };
            }

            await chrome.storage.sync.set({ siteSettings });
            renderList(elements.searchInput.value);
            showMessage("Import successful", false);
        } catch {
            showMessage("Import failed (invalid file)");
        }
    };
    reader.readAsText(file);
    e.target.value = "";
}

// -------------------------
// Init
// -------------------------

document.addEventListener("DOMContentLoaded", async () => {
    // Load Settings
    const data = await chrome.storage.sync.get({
        globalBehavior: "block",
        siteSettings: {}
    });

    siteSettings = data.siteSettings;
    elements.globalBehavior.value = data.globalBehavior;

    renderList();

    // Listeners
    elements.globalBehavior.addEventListener("change", (e) => {
        chrome.storage.sync.set({ globalBehavior: e.target.value });
        showMessage("Global default updated", false);
    });

    elements.addButton.addEventListener("click", addDomain);
    elements.exportBtn.addEventListener("click", exportSettings);
    elements.importBtn.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", handleImport);

    elements.resetBtn.addEventListener("click", async () => {
        if (confirm("Clear all site settings?")) {
            siteSettings = {};
            await chrome.storage.sync.set({ siteSettings });
            renderList();
            showMessage("All settings cleared", false);
        }
    });

    elements.searchInput.addEventListener("input", () => renderList(elements.searchInput.value));

    // Debug
    chrome.storage.local.get({ debugEnabled: false }, ({ debugEnabled }) => {
        document.getElementById("debugToggle").checked = debugEnabled;
    });
    document.getElementById("debugToggle").addEventListener("change", (e) => {
        chrome.storage.local.set({ debugEnabled: e.target.checked });
    });

    // Version
    document.getElementById("appVersion").textContent = `v${chrome.runtime.getManifest().version}`;
});
