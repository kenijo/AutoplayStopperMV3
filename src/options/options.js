// -------------------------
// Options Page
// -------------------------

// DOM Elements
const elements = {
    addButton: document.getElementById("addDomain"),
    domainInput: document.getElementById("domainInput"),
    domainList: document.getElementById("domainList"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    message: document.getElementById("message"),
    resetBtn: document.getElementById("resetBtn"),
    searchInput: document.getElementById("searchInput")
};

// State
let currentDomains = [];

// -------------------------
// Utilities
// -------------------------

/**
 * Creates ripple effect on button click
 * @param {HTMLElement} button - Button element to add ripple to
 */
function setupRipple(button) {
    button.style.position = "relative";
    button.style.overflow = "hidden";

    button.addEventListener("click", (e) => {
        const ripple = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        Object.assign(ripple.style, {
            width: `${diameter}px`,
            height: `${diameter}px`,
            left: `${e.clientX - button.offsetLeft - radius}px`,
            top: `${e.clientY - button.offsetTop - radius}px`,
            position: "absolute",
            borderRadius: "50%",
            backgroundColor: "var(--color_light)",
            transform: "scale(0)",
            animation: "ripple 600ms linear",
            pointerEvents: "none"
        });

        ripple.classList.add("ripple");
        button.appendChild(ripple);

        // Clean up after animation
        setTimeout(() => ripple.remove(), 600);
    });
}

/**
 * Validates domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if valid domain
 * - Supports normal domains (example.com)
 * - Supports localhost
 * - Supports *.local internal domains (office.local)
 */
function isValidDomain(domain) {
    domain = domain.trim().toLowerCase();

    // allow localhost
    if (domain === "localhost") return true;

    // allow *.local (dev.local, internal.local, etc)
    if (domain.endsWith(".local")) return true;

    // normal domain validation
    return /^(?!-)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(domain);
}

/**
 * Shows temporary message
 * @param {string} text - Message text
 * @param {boolean} [isError=true] - Whether message is error
 */
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

// -------------------------
// Domain Management
// -------------------------

/**
 * Renders domain list with optional filter
 * @param {string} [filter=""] - Filter string
 */
function renderDomainList(filter = "") {
    elements.domainList.innerHTML = "";

    const filtered = [...currentDomains]
        .filter(d => d.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    filtered.forEach(domain => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = domain;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "btn btn-danger";
        setupRipple(removeBtn);

        removeBtn.addEventListener("click", () => removeDomain(domain));

        li.append(span, removeBtn);
        elements.domainList.appendChild(li);
    });
}

/**
 * Removes domain from whitelist
 * @param {string} domain - Domain to remove
 */
function removeDomain(domain) {
    const newDomains = currentDomains.filter(d => d !== domain);
    updateWhitelist(newDomains);
    showMessage(`Removed ${domain}`, false);
}

/**
 * Adds domain to whitelist
 */
function addDomain() {
    let domain = elements.domainInput.value.trim();
    if (!domain) {
        showMessage("Please enter a domain");
        return;
    }

    // Clean domain input
    domain = domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    if (!isValidDomain(domain)) {
        showMessage("Invalid domain format (e.g., example.com, localhost, dev.local)");
        return;
    }

    if (currentDomains.includes(domain)) {
        showMessage("Domain already whitelisted");
        return;
    }

    updateWhitelist([...currentDomains, domain]);
    elements.domainInput.value = "";
    showMessage(`Added ${domain}`, false);
}

/**
 * Updates whitelist in storage and UI
 * @param {string[]} domains - New domain list
 */
function updateWhitelist(domains) {
    currentDomains = domains;
    chrome.storage.local.set({ whitelist: domains }, () => {
        renderDomainList(elements.searchInput.value);
    });
}

// -------------------------
// Import/Export
// -------------------------

/**
 * Exports whitelist to JSON file
 */
function exportWhitelist() {
    const validDomains = currentDomains
        .map(d => (typeof d === "string" ? d.trim() : ""))
        .filter(isValidDomain);

    if (validDomains.length === 0) {
        showMessage("No valid domains to export");
        return;
    }

    const blob = new Blob([JSON.stringify(validDomains, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "autoplaystopper-whitelist.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage("Whitelist exported", false);
}

/**
 * Handles file import
 * @param {Event} e - Change event
 */
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!Array.isArray(imported)) {
                showMessage("Invalid format (must be JSON array)");
                return;
            }

            const validDomains = imported
                .map(d => (typeof d === "string" ? d.trim() : ""))
                .filter(isValidDomain);

            if (validDomains.length === 0) {
                showMessage("No valid domains found");
                return;
            }

            const shouldOverwrite = confirm(
                "Overwrite current whitelist?\n\n" +
                "OK = Overwrite, Cancel = Merge"
            );

            const newList = shouldOverwrite
                ? validDomains
                : [...new Set([...currentDomains, ...validDomains])];

            updateWhitelist(newList.sort());
            showMessage(shouldOverwrite ? "Whitelist overwritten" : "Whitelist merged", false);
        } catch {
            showMessage("Import failed (invalid file)");
        }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
}

// -------------------------
// Event Listeners
// -------------------------

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    // Load existing debug flag
    chrome.storage.local.get({ debugEnabled: false }, ({ debugEnabled }) => {
        document.getElementById("debugToggle").checked = debugEnabled;
    });

    // Listen for changes to debug flag
    document.getElementById("debugToggle").addEventListener("change", (e) => {
        chrome.storage.local.set({ debugEnabled: e.target.checked });
    });

    // Load saved whitelist
    chrome.storage.local.get({ whitelist: [] }, ({ whitelist }) => {
        currentDomains = whitelist;
        renderDomainList();
    });

    // Retrieve extension version
    const version = chrome.runtime.getManifest().version;
    document.getElementById("appVersion").textContent = `v${version}`;

    // Setup ripple effects
    setupRipple(elements.addButton);
    setupRipple(elements.importBtn);
    setupRipple(elements.exportBtn);
    setupRipple(elements.resetBtn);

    // Add domain
    elements.addButton.addEventListener("click", addDomain);

    // Import/export
    elements.exportBtn.addEventListener("click", exportWhitelist);
    elements.importBtn.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", handleImport);

    // Reset whitelist
    elements.resetBtn.addEventListener("click", () => {
        if (confirm("Clear entire whitelist? This cannot be undone.")) {
            updateWhitelist([]);
            showMessage("Whitelist cleared", false);
        }
    });

    // Search functionality
    elements.searchInput.addEventListener("input", () =>
        renderDomainList(elements.searchInput.value)
    );

    // Keyboard shortcuts
    elements.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.target.value = "";
            renderDomainList();
        }
    });

    elements.domainInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addDomain();
        if (e.key === "Escape") e.target.value = "";
    });

    // Global shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "/") {
            e.preventDefault();
            elements.searchInput.focus();
        }
    });
});
